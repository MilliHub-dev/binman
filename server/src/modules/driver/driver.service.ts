import {
  AssignmentStatus,
  BookingStatus,
  DriverAvailability,
  FailureReason,
  TruckStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { businessToday, formatDateOnly, slotWindowLabel, toDateOnly } from '../../lib/datetime';
import { storeImages, type StoredFile } from '../../services/storage.service';
import * as notifications from '../../services/notification.service';
import { transitionBooking } from '../bookings/bookings.service';
import { toUserSummary } from '../users/user.mapper';

const log = createLogger('driver');

/** Job list shape for the driver home screen (ui.md §50). */
const jobInclude = {
  booking: {
    include: {
      address: true,
      timeSlot: true,
      wasteBooking: true,
      cleaningBooking: true,
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  },
  truck: { select: { id: true, truckNumber: true, registrationNumber: true } },
} satisfies Prisma.BookingAssignmentInclude;

type JobWithRelations = Prisma.BookingAssignmentGetPayload<{ include: typeof jobInclude }>;

const toJobView = (assignment: JobWithRelations) => {
  const { booking } = assignment;
  return {
    assignmentId: assignment.id,
    assignmentStatus: assignment.status,
    acceptedAt: assignment.acceptedAt,
    booking: {
      id: booking.id,
      reference: booking.reference,
      serviceType: booking.serviceType,
      status: booking.status,
      scheduledDate: formatDateOnly(booking.scheduledDate),
      timeSlot: {
        label: booking.timeSlot.label,
        window: slotWindowLabel(booking.timeSlot.startTime, booking.timeSlot.endTime),
        startTime: booking.timeSlot.startTime,
      },
      // The driver needs to reach the customer and find the gate.
      customer: toUserSummary(booking.user),
      address: {
        label: booking.address.label,
        addressLine: booking.address.addressLine,
        area: booking.address.area,
        city: booking.address.city,
        latitude: booking.address.latitude,
        longitude: booking.address.longitude,
        instructions: booking.address.instructions,
        contactName: booking.address.contactName,
        contactPhone: booking.address.contactPhone,
      },
      waste: booking.wasteBooking,
      cleaning: booking.cleaningBooking,
      notes: booking.notes,
    },
    truck: assignment.truck,
  };
};

/** Resolves the driver profile for a signed-in user, or fails loudly. */
const requireDriverProfile = async (userId: string) => {
  const driver = await prisma.driver.findUnique({ where: { userId } });
  if (!driver) throw new ForbiddenError('No driver profile is linked to this account', 'NOT_A_DRIVER');
  return driver;
};

const scopeWhere = (scope: string, date?: string): Prisma.BookingAssignmentWhereInput => {
  switch (scope) {
    case 'today':
      return { booking: { scheduledDate: toDateOnly(date ?? businessToday()) } };
    case 'upcoming':
      return {
        booking: {
          scheduledDate: { gte: toDateOnly(businessToday()) },
          status: { notIn: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.FAILED] },
        },
      };
    case 'completed':
      return { status: AssignmentStatus.COMPLETED };
    default:
      return {};
  }
};

export const listJobs = async (userId: string, scope: string, date?: string) => {
  const driver = await requireDriverProfile(userId);

  const assignments = await prisma.bookingAssignment.findMany({
    where: {
      driverId: driver.id,
      status: { notIn: [AssignmentStatus.REASSIGNED, AssignmentStatus.CANCELLED] },
      ...scopeWhere(scope, date),
    },
    include: jobInclude,
    orderBy: [{ booking: { scheduledDate: 'asc' } }, { assignedAt: 'asc' }],
    take: 200,
  });

  return assignments.map(toJobView);
};

/** The driver home screen counters (driver.md §2). */
export const getDriverHome = async (userId: string) => {
  const driver = await requireDriverProfile(userId);
  const today = toDateOnly(businessToday());

  const [total, completed, active] = await Promise.all([
    prisma.bookingAssignment.count({
      where: {
        driverId: driver.id,
        booking: { scheduledDate: today },
        status: { notIn: [AssignmentStatus.REASSIGNED, AssignmentStatus.CANCELLED] },
      },
    }),
    prisma.bookingAssignment.count({
      where: { driverId: driver.id, booking: { scheduledDate: today }, status: AssignmentStatus.COMPLETED },
    }),
    prisma.bookingAssignment.findFirst({
      where: {
        driverId: driver.id,
        status: { in: [AssignmentStatus.ACCEPTED, AssignmentStatus.EN_ROUTE, AssignmentStatus.ARRIVED] },
      },
      include: jobInclude,
      orderBy: { assignedAt: 'asc' },
    }),
  ]);

  return {
    availabilityStatus: driver.availabilityStatus,
    today: { total, completed, remaining: Math.max(total - completed, 0) },
    activeJob: active ? toJobView(active) : null,
  };
};

/** Loads one job, enforcing that it belongs to this driver. */
export const getJob = async (userId: string, assignmentId: string) => {
  const driver = await requireDriverProfile(userId);
  const assignment = await prisma.bookingAssignment.findFirst({
    where: { id: assignmentId, driverId: driver.id },
    include: jobInclude,
  });
  if (!assignment) throw new NotFoundError('Job');
  return toJobView(assignment);
};

export const acceptJob = async (userId: string, assignmentId: string) => {
  const driver = await requireDriverProfile(userId);

  const assignment = await prisma.bookingAssignment.findFirst({
    where: { id: assignmentId, driverId: driver.id },
  });
  if (!assignment) throw new NotFoundError('Job');
  if (assignment.status !== AssignmentStatus.PENDING) {
    throw new ConflictError('This job has already been accepted', 'JOB_ALREADY_ACCEPTED');
  }

  await prisma.$transaction([
    prisma.bookingAssignment.update({
      where: { id: assignmentId },
      data: { status: AssignmentStatus.ACCEPTED, acceptedAt: new Date() },
    }),
    prisma.driver.update({
      where: { id: driver.id },
      data: { availabilityStatus: DriverAvailability.BUSY },
    }),
  ]);

  log.info({ assignmentId, driverId: driver.id }, 'job accepted');
  return getJob(userId, assignmentId);
};

/** Assignment status mirrors the booking status the driver just set. */
const ASSIGNMENT_FOR_BOOKING: Partial<Record<BookingStatus, AssignmentStatus>> = {
  [BookingStatus.DRIVER_EN_ROUTE]: AssignmentStatus.EN_ROUTE,
  [BookingStatus.ARRIVED]: AssignmentStatus.ARRIVED,
  [BookingStatus.COLLECTED]: AssignmentStatus.ARRIVED,
  [BookingStatus.COMPLETED]: AssignmentStatus.COMPLETED,
};

/**
 * Advances a job through the field workflow (driver.md §4).
 *
 * A job cannot be marked COMPLETED without proof of collection on file — that
 * is the whole point of §16 ("helps prevent false completion reports").
 */
export const updateJobStatus = async (
  userId: string,
  assignmentId: string,
  status: BookingStatus,
  location?: { latitude?: number; longitude?: number },
) => {
  const driver = await requireDriverProfile(userId);

  const assignment = await prisma.bookingAssignment.findFirst({
    where: { id: assignmentId, driverId: driver.id },
    include: { booking: { include: { timeSlot: true } } },
  });
  if (!assignment) throw new NotFoundError('Job');

  if (assignment.status === AssignmentStatus.PENDING) {
    throw new ConflictError('Accept the job before updating its status', 'JOB_NOT_ACCEPTED');
  }

  if (status === BookingStatus.COMPLETED) {
    const proofCount = await prisma.collectionProof.count({ where: { bookingId: assignment.bookingId } });
    if (proofCount === 0) {
      throw new ConflictError(
        'Upload proof of collection before completing this job',
        'PROOF_REQUIRED',
      );
    }
  }

  // Validates the transition and writes history.
  await transitionBooking(assignment.bookingId, status, {
    actorId: userId,
    reason: `Driver marked ${status}`,
  });

  const now = new Date();
  await prisma.bookingAssignment.update({
    where: { id: assignmentId },
    data: {
      ...(ASSIGNMENT_FOR_BOOKING[status] ? { status: ASSIGNMENT_FOR_BOOKING[status] } : {}),
      ...(status === BookingStatus.DRIVER_EN_ROUTE ? { enRouteAt: now } : {}),
      ...(status === BookingStatus.ARRIVED ? { arrivedAt: now } : {}),
      ...(status === BookingStatus.COMPLETED ? { completedAt: now } : {}),
    },
  });

  if (location?.latitude !== undefined && location.longitude !== undefined) {
    await recordLocation(userId, {
      latitude: location.latitude,
      longitude: location.longitude,
      bookingId: assignment.bookingId,
    });
  }

  // Free the driver and truck once the job is done.
  if (status === BookingStatus.COMPLETED) {
    await prisma.driver.update({
      where: { id: driver.id },
      data: { availabilityStatus: DriverAvailability.AVAILABLE },
    });
    if (assignment.truckId) {
      await prisma.truck.update({
        where: { id: assignment.truckId },
        data: { status: TruckStatus.AVAILABLE },
      });
    }
  }

  const booking = assignment.booking;
  switch (status) {
    case BookingStatus.DRIVER_EN_ROUTE:
      void notifications.notifyDriverEnRoute(booking);
      break;
    case BookingStatus.ARRIVED:
      void notifications.notifyDriverArrived(booking);
      break;
    case BookingStatus.COMPLETED:
      void notifications.notifyCollectionCompleted(booking);
      break;
    default:
      break;
  }

  log.info({ assignmentId, bookingId: assignment.bookingId, status }, 'driver updated job status');

  return getJob(userId, assignmentId);
};

/** Photo + GPS + timestamp evidence (prd.md §16). */
export const submitProof = async (
  userId: string,
  assignmentId: string,
  files: Express.Multer.File[],
  input: { latitude?: number; longitude?: number; notes?: string; customerConfirmed: boolean },
) => {
  const driver = await requireDriverProfile(userId);

  const assignment = await prisma.bookingAssignment.findFirst({
    where: { id: assignmentId, driverId: driver.id },
  });
  if (!assignment) throw new NotFoundError('Job');

  if (files.length === 0) {
    throw new ConflictError('At least one photo is required', 'PHOTO_REQUIRED');
  }

  const stored: StoredFile[] = await storeImages(files, 'proofs');

  const proof = await prisma.collectionProof.create({
    data: {
      bookingId: assignment.bookingId,
      assignmentId: assignment.id,
      photoUrls: stored.map((f) => f.url),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      customerConfirmed: input.customerConfirmed,
      notes: input.notes ?? null,
      submittedBy: userId,
      capturedAt: new Date(),
    },
  });

  log.info({ assignmentId, proofId: proof.id, photos: stored.length }, 'proof of collection submitted');
  return proof;
};

/** A failed collection always requires a reason (driver.md §7). */
export const failJob = async (
  userId: string,
  assignmentId: string,
  input: { reason: FailureReason; description?: string; latitude?: number; longitude?: number },
) => {
  const driver = await requireDriverProfile(userId);

  const assignment = await prisma.bookingAssignment.findFirst({
    where: { id: assignmentId, driverId: driver.id },
    include: { booking: { include: { timeSlot: true } } },
  });
  if (!assignment) throw new NotFoundError('Job');

  await prisma.collectionFailure.create({
    data: {
      bookingId: assignment.bookingId,
      assignmentId: assignment.id,
      reason: input.reason,
      description: input.description ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      reportedBy: userId,
    },
  });

  await transitionBooking(assignment.bookingId, BookingStatus.FAILED, {
    actorId: userId,
    reason: `Collection failed: ${input.reason}`,
  });

  await prisma.$transaction([
    prisma.bookingAssignment.update({
      where: { id: assignmentId },
      data: { status: AssignmentStatus.FAILED },
    }),
    prisma.driver.update({
      where: { id: driver.id },
      data: { availabilityStatus: DriverAvailability.AVAILABLE },
    }),
  ]);

  void notifications.notifyCollectionFailed(
    assignment.booking,
    input.reason.toLowerCase().replace(/_/g, ' '),
  );

  log.warn({ assignmentId, reason: input.reason }, 'collection failed');

  return getJob(userId, assignmentId);
};

/**
 * Location ping. Kept to active jobs by the client (driver.md §5); the history
 * row also gives operations an after-the-fact route trace.
 */
export const recordLocation = async (
  userId: string,
  input: { latitude: number; longitude: number; bookingId?: string },
) => {
  const driver = await requireDriverProfile(userId);
  const now = new Date();

  await prisma.$transaction([
    prisma.driver.update({
      where: { id: driver.id },
      data: {
        currentLatitude: input.latitude,
        currentLongitude: input.longitude,
        lastLocationAt: now,
      },
    }),
    prisma.driverLocation.create({
      data: {
        driverId: driver.id,
        bookingId: input.bookingId ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        recordedAt: now,
      },
    }),
  ]);
};

export const setAvailability = async (userId: string, availabilityStatus: DriverAvailability) => {
  const driver = await requireDriverProfile(userId);
  return prisma.driver.update({
    where: { id: driver.id },
    data: { availabilityStatus },
    select: { id: true, availabilityStatus: true },
  });
};
