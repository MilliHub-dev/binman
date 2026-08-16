import { BookingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors';
import { env } from '../../config/env';
import {
  businessToday,
  dayjs,
  isSlotInPast,
  minutesToLabel,
  slotWindowLabel,
  toDateOnly,
} from '../../lib/datetime';

/**
 * Statuses that still occupy a slot. Cancelled and failed jobs release their
 * place; everything else, including an unpaid booking inside its payment
 * window, holds it.
 */
export const OCCUPYING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAID,
  BookingStatus.PENDING_ASSIGNMENT,
  BookingStatus.ASSIGNED,
  BookingStatus.DRIVER_EN_ROUTE,
  BookingStatus.ARRIVED,
  BookingStatus.COLLECTED,
  BookingStatus.COMPLETED,
];

export interface SlotAvailability {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  window: string;
  maxBookings: number;
  booked: number;
  remaining: number;
  available: boolean;
  /** Why the slot cannot be picked, for the disabled state in the UI. */
  unavailableReason: 'FULL' | 'PAST' | null;
}

export const listActiveSlots = () =>
  prisma.timeSlot.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });

/**
 * Availability for a single date (ui.md §17 — "Unavailable slots should be
 * disabled").
 *
 * Capacity is counted PER DATE, which is what `TimeSlot.maxBookings` means:
 * a slot's ceiling applies to each day independently, not to all time.
 */
export const getAvailability = async (date: string): Promise<SlotAvailability[]> => {
  assertBookableDate(date);

  const slots = await listActiveSlots();
  if (slots.length === 0) return [];

  const counts = await prisma.booking.groupBy({
    by: ['timeSlotId'],
    where: {
      scheduledDate: toDateOnly(date),
      status: { in: OCCUPYING_STATUSES },
    },
    _count: { _all: true },
  });

  const byId = new Map(counts.map((c) => [c.timeSlotId, c._count._all]));

  return slots.map((slot) => {
    const booked = byId.get(slot.id) ?? 0;
    const remaining = Math.max(slot.maxBookings - booked, 0);
    const past = isSlotInPast(date, slot.startTime);

    return {
      id: slot.id,
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      window: slotWindowLabel(slot.startTime, slot.endTime),
      maxBookings: slot.maxBookings,
      booked,
      remaining,
      available: remaining > 0 && !past,
      unavailableReason: past ? 'PAST' : remaining === 0 ? 'FULL' : null,
    };
  });
};

/** Availability across a window of days, for the date strip on the booking screen. */
export const getAvailabilityRange = async (
  from: string,
  days: number,
): Promise<Array<{ date: string; slots: SlotAvailability[] }>> => {
  const start = dayjs.utc(from, 'YYYY-MM-DD');
  const dates = Array.from({ length: days }, (_, i) => start.add(i, 'day').format('YYYY-MM-DD'));

  return Promise.all(
    dates.map(async (date) => ({
      date,
      slots: await getAvailability(date).catch(() => []),
    })),
  );
};

export const assertBookableDate = (date: string): void => {
  const target = dayjs.utc(date, 'YYYY-MM-DD', true);
  if (!target.isValid()) throw new BadRequestError('Invalid date', 'INVALID_DATE');

  const today = dayjs.utc(businessToday(), 'YYYY-MM-DD');

  if (target.isBefore(today, 'day')) {
    throw new BadRequestError('Pickup date cannot be in the past', 'DATE_IN_PAST');
  }

  const maxDate = today.add(env.MAX_ADVANCE_BOOKING_DAYS, 'day');
  if (target.isAfter(maxDate, 'day')) {
    throw new BadRequestError(
      `Bookings can only be made up to ${env.MAX_ADVANCE_BOOKING_DAYS} days in advance`,
      'DATE_TOO_FAR',
    );
  }
};

/**
 * Validates a (date, slot) pair for booking.
 *
 * NOTE: this is a pre-check for a clear error message. The authoritative
 * capacity check happens inside the booking transaction, because two customers
 * can pass this check simultaneously for the last remaining place.
 */
export const assertSlotBookable = async (
  slotId: string,
  date: string,
): Promise<{ id: string; label: string; startTime: number; endTime: number; maxBookings: number }> => {
  assertBookableDate(date);

  const slot = await prisma.timeSlot.findUnique({ where: { id: slotId } });
  if (!slot) throw new NotFoundError('Time slot');
  if (!slot.isActive) throw new BadRequestError('That time slot is no longer offered', 'SLOT_INACTIVE');

  if (isSlotInPast(date, slot.startTime)) {
    throw new BadRequestError(
      `The ${minutesToLabel(slot.startTime)} slot has already started`,
      'SLOT_IN_PAST',
    );
  }

  const booked = await prisma.booking.count({
    where: { timeSlotId: slotId, scheduledDate: toDateOnly(date), status: { in: OCCUPYING_STATUSES } },
  });

  if (booked >= slot.maxBookings) {
    throw new ConflictError(
      `The ${slotWindowLabel(slot.startTime, slot.endTime)} slot is fully booked on ${date}. Please pick another time.`,
      'SLOT_FULL',
    );
  }

  return slot;
};

export const createTimeSlot = (data: {
  label: string;
  startTime: number;
  endTime: number;
  maxBookings?: number;
  sortOrder?: number;
  isActive?: boolean;
}) => {
  if (data.endTime <= data.startTime) {
    throw new BadRequestError('Slot end time must be after its start time', 'INVALID_SLOT_WINDOW');
  }
  return prisma.timeSlot.create({ data });
};

export const updateTimeSlot = async (
  id: string,
  data: Partial<{
    label: string;
    startTime: number;
    endTime: number;
    maxBookings: number;
    sortOrder: number;
    isActive: boolean;
  }>,
) => {
  const slot = await prisma.timeSlot.findUnique({ where: { id } });
  if (!slot) throw new NotFoundError('Time slot');

  const start = data.startTime ?? slot.startTime;
  const end = data.endTime ?? slot.endTime;
  if (end <= start) {
    throw new BadRequestError('Slot end time must be after its start time', 'INVALID_SLOT_WINDOW');
  }

  return prisma.timeSlot.update({ where: { id }, data });
};
