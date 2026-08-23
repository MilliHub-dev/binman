import {
  AssignmentStatus,
  BookingStatus,
  DriverAvailability,
  Role,
  ServiceType,
  TruckStatus,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors';
import { businessToday, formatDateOnly, slotWindowLabel, toDateOnly } from '../../lib/datetime';
import * as notifications from '../../services/notification.service';
import { transitionBooking } from '../bookings/bookings.service';
import { bookingInclude, toBookingView } from '../bookings/booking.mapper';
import { recordAudit } from '../../lib/audit';

const log = createLogger('dispatch');

/**
 * The dispatch board (admin.md §4): unassigned work on the left, available
 * drivers and trucks on the right.
 */
export const getDispatchBoard = async (date?: string) => {
  const target = toDateOnly(date ?? businessToday());

  const [unassigned, drivers, trucks, awaitingPayment, elsewhere] = await Promise.all([
    prisma.booking.findMany({
      where: {
        scheduledDate: target,
        status: { in: [BookingStatus.PAID, BookingStatus.PENDING_ASSIGNMENT] },
      },
      include: {
        address: { select: { area: true, city: true, addressLine: true, latitude: true, longitude: true } },
        timeSlot: true,
        wasteBooking: true,
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
      orderBy: [{ timeSlot: { startTime: 'asc' } }, { createdAt: 'asc' }],
    }),
    prisma.driver.findMany({
      where: { availabilityStatus: { not: DriverAvailability.SUSPENDED } },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        defaultTruck: { select: { id: true, truckNumber: true, status: true } },
        _count: {
          select: {
            assignments: {
              where: {
                booking: { scheduledDate: target },
                status: { notIn: [AssignmentStatus.REASSIGNED, AssignmentStatus.CANCELLED] },
              },
            },
          },
        },
      },
      orderBy: { availabilityStatus: 'asc' },
    }),
    prisma.truck.findMany({
      where: { status: { notIn: [TruckStatus.OUT_OF_SERVICE] } },
      orderBy: { truckNumber: 'asc' },
    }),
    /**
     * Why the board might be empty.
     *
     * A dispatcher looking at nothing cannot tell the difference between "no
     * work today" and "the work exists but is unpaid, or is on another day".
     * Both answers are cheap to fetch and turn a blank screen into a fact.
     */
    prisma.booking.count({
      where: { scheduledDate: target, status: BookingStatus.PENDING_PAYMENT },
    }),
    prisma.booking.groupBy({
      by: ['scheduledDate'],
      where: {
        scheduledDate: { gt: target },
        status: { in: [BookingStatus.PAID, BookingStatus.PENDING_ASSIGNMENT] },
      },
      _count: { _all: true },
      orderBy: { scheduledDate: 'asc' },
      take: 5,
    }),
  ]);

  return {
    date: formatDateOnly(target),
    unassigned: unassigned.map((b) => ({
      id: b.id,
      reference: b.reference,
      serviceType: b.serviceType,
      status: b.status,
      customer: [b.user.firstName, b.user.lastName].filter(Boolean).join(' ') || b.user.phone,
      phone: b.user.phone,
      area: b.address.area,
      addressLine: b.address.addressLine,
      latitude: b.address.latitude,
      longitude: b.address.longitude,
      window: slotWindowLabel(b.timeSlot.startTime, b.timeSlot.endTime),
      collectionSize: b.wasteBooking?.collectionSize ?? null,
      wasteTypes: b.wasteBooking?.wasteTypes ?? [],
      paymentStatus: b.paymentStatus,
      totalAmount: b.totalAmount,
    })),
    drivers: drivers.map((d) => ({
      id: d.id,
      name: [d.user.firstName, d.user.lastName].filter(Boolean).join(' ') || null,
      phone: d.user.phone,
      status: d.availabilityStatus,
      jobsToday: d._count.assignments,
      defaultTruck: d.defaultTruck,
      verificationStatus: d.verificationStatus,
    })),
    trucks,
    awaitingPayment,
    /** Upcoming dates that do have work, so the UI can offer a way there. */
    upcoming: elsewhere.map((row) => ({
      date: formatDateOnly(row.scheduledDate),
      count: row._count._all,
    })),
  };
};

interface AssignInput {
  driverId?: string;
  truckId?: string;
  cleanerId?: string;
}

/**
 * Statuses a dispatcher can assign from. DRIVER_EN_ROUTE is included so a
 * breakdown mid-route can be handed to another team, and FAILED so a retry can
 * be re-queued.
 */
const ASSIGNABLE_STATUSES: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.PENDING_ASSIGNMENT,
  BookingStatus.ASSIGNED,
  BookingStatus.DRIVER_EN_ROUTE,
  BookingStatus.FAILED,
];

/** A truck in either of these states cannot take new work. */
const TRUCK_UNAVAILABLE_STATUSES: TruckStatus[] = [
  TruckStatus.MAINTENANCE,
  TruckStatus.OUT_OF_SERVICE,
];

/**
 * Assigns a booking to a team (prd.md §15, steps 4–5).
 *
 * Reassignment is supported: the previous assignment is closed as REASSIGNED
 * rather than edited, so the audit trail shows every team the job passed
 * through.
 */
export const assignBooking = async (
  bookingId: string,
  input: AssignInput,
  actorId: string,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { timeSlot: true },
  });
  if (!booking) throw new NotFoundError('Booking');

  if (booking.serviceType === ServiceType.WASTE_COLLECTION && !input.driverId) {
    throw new BadRequestError('A driver is required for a waste collection', 'DRIVER_REQUIRED');
  }
  if (booking.serviceType === ServiceType.CLEANING && !input.cleanerId) {
    throw new BadRequestError('A cleaner is required for a cleaning booking', 'CLEANER_REQUIRED');
  }

  if (!ASSIGNABLE_STATUSES.includes(booking.status)) {
    throw new ConflictError(
      `A booking with status ${booking.status} cannot be assigned`,
      'BOOKING_NOT_ASSIGNABLE',
    );
  }

  // Validate the people and equipment actually exist and can take the work.
  if (input.driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: input.driverId } });
    if (!driver) throw new NotFoundError('Driver');
    if (driver.availabilityStatus === DriverAvailability.SUSPENDED) {
      throw new ConflictError('That driver is suspended', 'DRIVER_SUSPENDED');
    }
  }

  if (input.truckId) {
    const truck = await prisma.truck.findUnique({ where: { id: input.truckId } });
    if (!truck) throw new NotFoundError('Truck');
    if (TRUCK_UNAVAILABLE_STATUSES.includes(truck.status)) {
      throw new ConflictError('That truck is not available', 'TRUCK_UNAVAILABLE');
    }
  }

  if (input.cleanerId) {
    const cleaner = await prisma.user.findFirst({
      where: { id: input.cleanerId, role: Role.CLEANER },
    });
    if (!cleaner) throw new NotFoundError('Cleaner');
  }

  const previous = await prisma.bookingAssignment.findFirst({
    where: {
      bookingId,
      status: { notIn: [AssignmentStatus.REASSIGNED, AssignmentStatus.CANCELLED, AssignmentStatus.COMPLETED] },
    },
    orderBy: { assignedAt: 'desc' },
  });

  const assignment = await prisma.$transaction(async (tx) => {
    if (previous) {
      await tx.bookingAssignment.update({
        where: { id: previous.id },
        data: { status: AssignmentStatus.REASSIGNED },
      });
    }

    const created = await tx.bookingAssignment.create({
      data: {
        bookingId,
        driverId: input.driverId ?? null,
        truckId: input.truckId ?? null,
        cleanerId: input.cleanerId ?? null,
        assignedBy: actorId,
        status: AssignmentStatus.PENDING,
      },
    });

    if (input.truckId) {
      await tx.truck.update({ where: { id: input.truckId }, data: { status: TruckStatus.ASSIGNED } });
    }

    return created;
  });

  // A FAILED booking must go back through PENDING_ASSIGNMENT before ASSIGNED.
  if (booking.status === BookingStatus.FAILED) {
    await transitionBooking(bookingId, BookingStatus.PENDING_ASSIGNMENT, {
      actorId,
      reason: 'Re-queued for dispatch after failure',
    });
  }

  await transitionBooking(bookingId, BookingStatus.ASSIGNED, {
    actorId,
    reason: previous ? 'Reassigned to a new team' : 'Assigned to a collection team',
  });

  const driverName = input.driverId
    ? await prisma.driver
        .findUnique({
          where: { id: input.driverId },
          select: { user: { select: { firstName: true, lastName: true } } },
        })
        .then((d) => [d?.user.firstName, d?.user.lastName].filter(Boolean).join(' ') || null)
    : null;

  void notifications.notifyTeamAssigned(booking, driverName);

  void recordAudit({
    userId: actorId,
    action: previous ? 'BOOKING_REASSIGNED' : 'BOOKING_ASSIGNED',
    entity: 'Booking',
    entityId: bookingId,
    oldData: previous ? { driverId: previous.driverId, truckId: previous.truckId } : null,
    newData: { driverId: input.driverId, truckId: input.truckId, cleanerId: input.cleanerId },
  });

  log.info({ bookingId, assignmentId: assignment.id, ...input }, 'booking assigned');

  const fresh = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: bookingInclude,
  });
  return toBookingView(fresh);
};

/** Removes the current assignment and returns the booking to the queue. */
export const unassignBooking = async (bookingId: string, actorId: string, reason?: string) => {
  const assignment = await prisma.bookingAssignment.findFirst({
    where: {
      bookingId,
      status: { notIn: [AssignmentStatus.REASSIGNED, AssignmentStatus.CANCELLED, AssignmentStatus.COMPLETED] },
    },
    orderBy: { assignedAt: 'desc' },
  });
  if (!assignment) throw new NotFoundError('Assignment');

  await prisma.$transaction(async (tx) => {
    await tx.bookingAssignment.update({
      where: { id: assignment.id },
      data: { status: AssignmentStatus.CANCELLED },
    });
    if (assignment.truckId) {
      await tx.truck.update({ where: { id: assignment.truckId }, data: { status: TruckStatus.AVAILABLE } });
    }
    if (assignment.driverId) {
      await tx.driver.update({
        where: { id: assignment.driverId },
        data: { availabilityStatus: DriverAvailability.AVAILABLE },
      });
    }
  });

  await transitionBooking(bookingId, BookingStatus.PENDING_ASSIGNMENT, {
    actorId,
    reason: reason ?? 'Unassigned by dispatcher',
  });

  void recordAudit({
    userId: actorId,
    action: 'BOOKING_UNASSIGNED',
    entity: 'Booking',
    entityId: bookingId,
    oldData: { driverId: assignment.driverId, truckId: assignment.truckId },
  });

  const fresh = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: bookingInclude,
  });
  return toBookingView(fresh);
};
