import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  ServiceType,
  type Booking,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { createLogger } from '../../lib/logger';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { generateBookingReference } from '../../lib/reference';
import { buildMeta, toSkipTake, type PaginationInput } from '../../lib/pagination';
import { businessToday, hoursUntilSlot, toDateOnly } from '../../lib/datetime';
import { assertSlotBookable, OCCUPYING_STATUSES } from '../time-slots/time-slots.service';
import { assertServiceable } from '../service-areas/service-areas.service';
import { quote } from '../pricing/pricing.service';
import { isStaff } from '../../middleware/authorize';
import * as notifications from '../../services/notification.service';
import { bookingInclude, toBookingView, type BookingView } from './booking.mapper';
import { assertTransition, CUSTOMER_CANCELLABLE, ACTIVE_STATUSES } from './booking.status';
import type { CreateBookingInput, ListBookingsQuery } from './bookings.schema';

const log = createLogger('bookings');

const loadView = async (bookingId: string): Promise<BookingView> => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking) throw new NotFoundError('Booking');
  return toBookingView(booking);
};

/**
 * Creates a booking (prd.md §10).
 *
 * The price is computed server-side and snapshotted onto the row — the client
 * never supplies an amount, and a later price change cannot alter what was
 * agreed.
 *
 * The whole thing runs at SERIALIZABLE isolation: capacity is a read-then-write
 * decision, and at READ COMMITTED two customers can both see the last free
 * place and both take it. Postgres will abort one of the two transactions
 * instead, which surfaces as a retryable conflict.
 */
export const createBooking = async (
  userId: string,
  input: CreateBookingInput,
): Promise<BookingView> => {
  const address = await prisma.address.findFirst({
    where: { id: input.addressId, userId, deletedAt: null },
  });
  if (!address) throw new NotFoundError('Address');

  // Rejects out-of-coverage locations before anything is written (admin.md §7).
  const serviceArea = await assertServiceable(address.area, address.city);

  // Friendly, specific errors for a past date, a dead slot or a full slot.
  const slot = await assertSlotBookable(input.timeSlotId, input.scheduledDate);

  const priced = await quote({
    serviceType: input.serviceType,
    ...(input.wasteTypes ? { wasteTypes: input.wasteTypes } : {}),
    ...(input.collectionSize ? { collectionSize: input.collectionSize } : {}),
    ...(input.cleaningType ? { cleaningType: input.cleaningType } : {}),
    ...(input.propertySize ? { propertySize: input.propertySize } : {}),
    serviceAreaId: serviceArea.id,
  });

  const scheduledDate = toDateOnly(input.scheduledDate);

  const booking = await prisma.$transaction(
    async (tx) => {
      // Authoritative capacity check — the pre-check above is only for a nicer
      // error message.
      const taken = await tx.booking.count({
        where: { timeSlotId: slot.id, scheduledDate, status: { in: OCCUPYING_STATUSES } },
      });
      if (taken >= slot.maxBookings) {
        throw new ConflictError(
          'That time slot has just filled up. Please choose another time.',
          'SLOT_FULL',
        );
      }

      const created = await tx.booking.create({
        data: {
          reference: generateBookingReference(input.serviceType),
          userId,
          serviceType: input.serviceType,
          addressId: address.id,
          serviceAreaId: serviceArea.id,
          scheduledDate,
          timeSlotId: slot.id,
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: priced.subtotal,
          serviceFee: priced.serviceFee,
          discount: priced.discount,
          totalAmount: priced.total,
          currency: priced.currency,
          notes: input.notes ?? null,

          ...(input.serviceType === ServiceType.WASTE_COLLECTION
            ? {
                wasteBooking: {
                  create: {
                    wasteTypes: input.wasteTypes ?? [],
                    collectionSize: input.collectionSize!,
                    estimatedQuantity: input.estimatedQuantity ?? null,
                    specialInstructions: input.specialInstructions ?? null,
                  },
                },
              }
            : {
                cleaningBooking: {
                  create: {
                    cleaningType: input.cleaningType!,
                    propertyType: input.propertyType!,
                    propertySize: input.propertySize!,
                    numberOfRooms: input.numberOfRooms ?? null,
                    specialInstructions: input.specialInstructions ?? null,
                  },
                },
              }),

          statusHistory: {
            create: {
              newStatus: BookingStatus.PENDING_PAYMENT,
              changedBy: userId,
              reason: 'Booking created',
            },
          },
        },
      });

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 },
  );

  log.info({ bookingId: booking.id, reference: booking.reference, userId }, 'booking created');

  return loadView(booking.id);
};

const scopeFilter = (scope: ListBookingsQuery['scope']): Prisma.BookingWhereInput => {
  switch (scope) {
    case 'upcoming':
      return {
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID, BookingStatus.PENDING_ASSIGNMENT] },
        scheduledDate: { gte: toDateOnly(businessToday()) },
      };
    case 'active':
      return {
        status: {
          in: [BookingStatus.ASSIGNED, BookingStatus.DRIVER_EN_ROUTE, BookingStatus.ARRIVED, BookingStatus.COLLECTED],
        },
      };
    case 'completed':
      return { status: { in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.FAILED] } };
    default:
      return {};
  }
};

export const listBookings = async (userId: string, query: ListBookingsQuery) => {
  const where: Prisma.BookingWhereInput = {
    userId,
    ...scopeFilter(query.scope),
    ...(query.status ? { status: query.status } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...(query.from || query.to
      ? {
          scheduledDate: {
            ...(query.from ? { gte: toDateOnly(query.from) } : {}),
            ...(query.to ? { lte: toDateOnly(query.to) } : {}),
          },
        }
      : {}),
  };

  const pagination: PaginationInput = { page: query.page, limit: query.limit };

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      ...toSkipTake(pagination),
    }),
    prisma.booking.count({ where }),
  ]);

  return { items: items.map(toBookingView), meta: buildMeta(total, pagination) };
};

/**
 * Loads a booking, enforcing access: a customer sees only their own, back-office
 * staff see everything.
 */
export const getBooking = async (
  bookingId: string,
  actor: { id: string; role: Express.AuthenticatedUser['role'] },
): Promise<BookingView> => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking) throw new NotFoundError('Booking');

  if (booking.userId !== actor.id && !isStaff(actor.role)) {
    // 404 rather than 403 — an outsider learns nothing about which ids exist.
    throw new NotFoundError('Booking');
  }

  return toBookingView(booking);
};

export const getBookingByReference = async (reference: string, userId: string): Promise<BookingView> => {
  const booking = await prisma.booking.findFirst({
    where: { reference: reference.toUpperCase(), userId },
    include: bookingInclude,
  });
  if (!booking) throw new NotFoundError('Booking');
  return toBookingView(booking);
};

/**
 * The one place a booking's status ever changes. Validates the transition,
 * writes the history row, and keeps side effects (assignment closure,
 * completion timestamps) in the same transaction as the status itself.
 */
export const transitionBooking = async (
  bookingId: string,
  newStatus: BookingStatus,
  options: { actorId?: string | null; reason?: string | null } = {},
): Promise<Booking> => {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundError('Booking');

    assertTransition(booking.status, newStatus);

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        ...(newStatus === BookingStatus.COMPLETED ? { completedAt: new Date() } : {}),
        ...(newStatus === BookingStatus.CANCELLED
          ? { cancelledAt: new Date(), cancellationReason: options.reason ?? null }
          : {}),
      },
    });

    await tx.bookingStatusHistory.create({
      data: {
        bookingId,
        oldStatus: booking.status,
        newStatus,
        changedBy: options.actorId ?? null,
        reason: options.reason ?? null,
      },
    });

    return updated;
  });

  /**
   * Outside the transaction: notifying is not something to roll back, and a
   * slow push should not hold a database transaction open.
   *
   * This path is how staff complete a booking. It used to tell the customer
   * nothing at all — only the driver's own "mark done" sent anything.
   */
  if (newStatus === BookingStatus.COMPLETED) {
    void notifications.onBookingCompleted(result);
  }

  return result;
};

/**
 * Customer cancellation (whatsapp.md "CANCELLATION" — check status, window,
 * refund policy).
 *
 * Refunds are deliberately NOT automatic: the operations team decides, because
 * a truck already dispatched has incurred real cost. The response tells the
 * customer which case they are in.
 */
export const cancelBooking = async (
  bookingId: string,
  userId: string,
  reason?: string,
): Promise<{ booking: BookingView; refundEligible: boolean; message: string }> => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { timeSlot: true },
  });
  if (!booking) throw new NotFoundError('Booking');

  if (!CUSTOMER_CANCELLABLE.includes(booking.status)) {
    throw new ConflictError(
      `This booking can no longer be cancelled (${booking.status.toLowerCase().replace(/_/g, ' ')}). Please contact support.`,
      'BOOKING_NOT_CANCELLABLE',
    );
  }

  const hoursLeft = hoursUntilSlot(booking.scheduledDate, booking.timeSlot.startTime);
  const withinFreeWindow = hoursLeft >= env.CANCELLATION_WINDOW_HOURS;
  const wasPaid = booking.paymentStatus === PaymentStatus.SUCCESSFUL;
  const refundEligible = wasPaid && withinFreeWindow;

  await transitionBooking(bookingId, BookingStatus.CANCELLED, {
    actorId: userId,
    reason: reason ?? 'Cancelled by customer',
  });

  void notifications.notifyBookingCancelled(booking, reason);

  log.info({ bookingId, userId, refundEligible, hoursLeft }, 'booking cancelled by customer');

  return {
    booking: await loadView(bookingId),
    refundEligible,
    message: !wasPaid
      ? 'Your booking has been cancelled.'
      : refundEligible
        ? 'Your booking has been cancelled. Your refund will be processed within 5–7 working days.'
        : `Your booking has been cancelled. Cancellations within ${env.CANCELLATION_WINDOW_HOURS} hours of the pickup window are not automatically refunded — contact support if you believe this is an error.`,
  };
};

/** Once a team is assigned, rescheduling is a dispatch decision, not a self-service one. */
const RESCHEDULABLE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAID,
  BookingStatus.PENDING_ASSIGNMENT,
];

/** Moves a booking to a different date/slot, re-checking capacity. */
export const rescheduleBooking = async (
  bookingId: string,
  userId: string,
  input: { scheduledDate: string; timeSlotId: string },
): Promise<BookingView> => {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId } });
  if (!booking) throw new NotFoundError('Booking');

  if (!RESCHEDULABLE_STATUSES.includes(booking.status)) {
    throw new ConflictError(
      'This booking can no longer be rescheduled. Please contact support.',
      'BOOKING_NOT_RESCHEDULABLE',
    );
  }

  const slot = await assertSlotBookable(input.timeSlotId, input.scheduledDate);
  const scheduledDate = toDateOnly(input.scheduledDate);

  await prisma.$transaction(
    async (tx) => {
      const taken = await tx.booking.count({
        where: {
          timeSlotId: slot.id,
          scheduledDate,
          status: { in: OCCUPYING_STATUSES },
          NOT: { id: bookingId },
        },
      });
      if (taken >= slot.maxBookings) {
        throw new ConflictError('That time slot has just filled up. Please choose another time.', 'SLOT_FULL');
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: { scheduledDate, timeSlotId: slot.id },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          oldStatus: booking.status,
          newStatus: booking.status,
          changedBy: userId,
          reason: `Rescheduled to ${input.scheduledDate}`,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return loadView(bookingId);
};

/** The status timeline on the tracking screen (ui.md §22). */
export const getBookingTimeline = async (bookingId: string, userId: string, role: Express.AuthenticatedUser['role']) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true },
  });
  if (!booking) throw new NotFoundError('Booking');
  if (booking.userId !== userId && !isStaff(role)) throw new NotFoundError('Booking');

  return prisma.bookingStatusHistory.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, oldStatus: true, newStatus: true, reason: true, createdAt: true },
  });
};

/** Used by the dashboard and the WhatsApp "My bookings" flow. */
export const countActiveBookings = (userId: string) =>
  prisma.booking.count({ where: { userId, status: { in: ACTIVE_STATUSES } } });
