import { BookingStatus, PaymentStatus, ServiceType, type Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import { buildMeta, toSkipTake, type PaginationInput } from '../../lib/pagination';
import { toDateOnly } from '../../lib/datetime';
import { bookingInclude, toBookingView } from '../bookings/booking.mapper';
import { transitionBooking } from '../bookings/bookings.service';
import { recordAudit } from '../../lib/audit';
import * as notifications from '../../services/notification.service';

export interface AdminBookingFilters {
  status?: BookingStatus;
  serviceType?: ServiceType;
  paymentStatus?: PaymentStatus;
  serviceAreaId?: string;
  driverId?: string;
  from?: string;
  to?: string;
  /** Matches booking reference, customer name or phone. */
  search?: string;
}

/** Booking management with the filters from admin.md §3. */
export const listBookings = async (pagination: PaginationInput, filters: AdminBookingFilters) => {
  const where: Prisma.BookingWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.serviceType ? { serviceType: filters.serviceType } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(filters.serviceAreaId ? { serviceAreaId: filters.serviceAreaId } : {}),
    ...(filters.driverId
      ? { assignments: { some: { driverId: filters.driverId, status: { notIn: ['REASSIGNED', 'CANCELLED'] } } } }
      : {}),
    ...(filters.from || filters.to
      ? {
          scheduledDate: {
            ...(filters.from ? { gte: toDateOnly(filters.from) } : {}),
            ...(filters.to ? { lte: toDateOnly(filters.to) } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { reference: { contains: filters.search.toUpperCase() } },
            { user: { phone: { contains: filters.search } } },
            { user: { firstName: { contains: filters.search, mode: 'insensitive' } } },
            { user: { lastName: { contains: filters.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { ...bookingInclude, user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      ...toSkipTake(pagination),
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    items: items.map((booking) => ({
      ...toBookingView(booking),
      customer: {
        id: booking.user.id,
        name: [booking.user.firstName, booking.user.lastName].filter(Boolean).join(' ') || null,
        phone: booking.user.phone,
      },
    })),
    meta: buildMeta(total, pagination),
  };
};

export const getBooking = async (bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      ...bookingInclude,
      user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      proofs: true,
      failures: true,
    },
  });
  if (!booking) throw new NotFoundError('Booking');

  return {
    ...toBookingView(booking),
    customer: booking.user,
    statusHistory: booking.statusHistory,
    proofs: booking.proofs,
    failures: booking.failures,
  };
};

/**
 * Manual status override by an operator. Still goes through the state machine —
 * admins get more entry points, not a licence to break the lifecycle.
 */
export const changeStatus = async (
  bookingId: string,
  status: BookingStatus,
  actorId: string,
  reason?: string,
) => {
  const before = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (!before) throw new NotFoundError('Booking');

  await transitionBooking(bookingId, status, { actorId, reason: reason ?? 'Changed by admin' });

  void recordAudit({
    userId: actorId,
    action: 'BOOKING_STATUS_CHANGED',
    entity: 'Booking',
    entityId: bookingId,
    oldData: { status: before.status },
    newData: { status, reason },
  });

  return getBooking(bookingId);
};

/** Admin-side cancellation — no customer cancellation-window restriction. */
export const cancelBooking = async (bookingId: string, actorId: string, reason: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { timeSlot: true },
  });
  if (!booking) throw new NotFoundError('Booking');

  await transitionBooking(bookingId, BookingStatus.CANCELLED, { actorId, reason });

  void notifications.notifyBookingCancelled(booking, reason);

  void recordAudit({
    userId: actorId,
    action: 'BOOKING_CANCELLED_BY_ADMIN',
    entity: 'Booking',
    entityId: bookingId,
    oldData: { status: booking.status },
    newData: { status: BookingStatus.CANCELLED, reason },
  });

  return getBooking(bookingId);
};
