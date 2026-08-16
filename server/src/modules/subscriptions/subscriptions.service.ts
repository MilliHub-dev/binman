import {
  BookingStatus,
  PaymentStatus,
  ServiceType,
  SubscriptionFrequency,
  SubscriptionStatus,
  type Subscription,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors';
import { generateBookingReference } from '../../lib/reference';
import { formatMoney } from '../../lib/money';
import {
  businessToday,
  dayjs,
  formatDateOnly,
  nextMatchingDate,
  toDateOnly,
} from '../../lib/datetime';
import { quote } from '../pricing/pricing.service';
import { assertServiceable } from '../service-areas/service-areas.service';
import { OCCUPYING_STATUSES } from '../time-slots/time-slots.service';
import type { CreateSubscriptionInput } from './subscriptions.schema';

const log = createLogger('subscriptions');

/**
 * Recurring collection (prd.md §18).
 *
 * A subscription is a template. A background sweep materialises the next
 * occurrence as an ordinary Booking, which then follows the normal lifecycle —
 * dispatch, driver, proof and all.
 */

/** How far ahead the next occurrence is scheduled after one is generated. */
const advanceBy = (frequency: SubscriptionFrequency): { amount: number; unit: 'day' | 'week' | 'month' } => {
  switch (frequency) {
    case SubscriptionFrequency.WEEKLY:
      return { amount: 1, unit: 'week' };
    case SubscriptionFrequency.TWICE_WEEKLY:
      // Handled by walking to the next matching weekday instead.
      return { amount: 1, unit: 'day' };
    case SubscriptionFrequency.BIWEEKLY:
      return { amount: 2, unit: 'week' };
    case SubscriptionFrequency.MONTHLY:
      return { amount: 1, unit: 'month' };
    default:
      return { amount: 1, unit: 'week' };
  }
};

/**
 * Computes the next run date strictly after `after`.
 *
 * TWICE_WEEKLY (and any multi-day schedule) walks to the next listed weekday;
 * everything else advances by a fixed interval and then snaps onto a listed
 * weekday.
 */
export const computeNextRunDate = (
  subscription: Pick<Subscription, 'frequency' | 'daysOfWeek' | 'endDate'>,
  after: string,
): Date | null => {
  const days = subscription.daysOfWeek;
  if (days.length === 0) return null;

  let candidate: Date | null;

  if (subscription.frequency === SubscriptionFrequency.TWICE_WEEKLY || days.length > 1) {
    candidate = nextMatchingDate(dayjs.utc(after, 'YYYY-MM-DD').add(1, 'day').format('YYYY-MM-DD'), days);
  } else {
    const { amount, unit } = advanceBy(subscription.frequency);
    const base = dayjs.utc(after, 'YYYY-MM-DD').add(amount, unit).format('YYYY-MM-DD');
    candidate = nextMatchingDate(base, days);
  }

  if (!candidate) return null;
  if (subscription.endDate && candidate.getTime() > subscription.endDate.getTime()) return null;

  return candidate;
};

export const createSubscription = async (userId: string, input: CreateSubscriptionInput) => {
  const address = await prisma.address.findFirst({
    where: { id: input.addressId, userId, deletedAt: null },
  });
  if (!address) throw new NotFoundError('Address');

  const serviceArea = await assertServiceable(address.area, address.city);

  const slot = await prisma.timeSlot.findUnique({ where: { id: input.timeSlotId } });
  if (!slot?.isActive) throw new BadRequestError('That time slot is not available', 'SLOT_INACTIVE');

  if (input.frequency === SubscriptionFrequency.TWICE_WEEKLY && input.daysOfWeek.length !== 2) {
    throw new BadRequestError('Twice-weekly subscriptions need exactly two days', 'INVALID_DAYS');
  }

  // Snapshot the price so a mid-subscription price change does not silently
  // alter what the customer signed up for.
  const priced = await quote({
    serviceType: input.serviceType,
    ...(input.wasteTypes ? { wasteTypes: input.wasteTypes } : {}),
    ...(input.collectionSize ? { collectionSize: input.collectionSize } : {}),
    serviceAreaId: serviceArea.id,
  });

  const startDate = input.startDate ?? businessToday();
  const firstRun = nextMatchingDate(startDate, input.daysOfWeek);
  if (!firstRun) throw new BadRequestError('Select at least one day of the week', 'INVALID_DAYS');

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      serviceType: input.serviceType,
      frequency: input.frequency,
      daysOfWeek: input.daysOfWeek,
      timeSlotId: input.timeSlotId,
      addressId: input.addressId,
      amount: priced.total,
      currency: priced.currency,
      wasteTypes: input.wasteTypes ?? [],
      collectionSize: input.collectionSize ?? null,
      status: SubscriptionStatus.ACTIVE,
      startDate: toDateOnly(startDate),
      endDate: input.endDate ? toDateOnly(input.endDate) : null,
      nextRunDate: firstRun,
    },
    include: { address: true, timeSlot: true },
  });

  log.info({ subscriptionId: subscription.id, userId }, 'subscription created');
  return withFormatting(subscription);
};

const withFormatting = <T extends { amount: number; currency: string; nextRunDate: Date | null }>(sub: T) => ({
  ...sub,
  amountFormatted: formatMoney(sub.amount, sub.currency),
  nextRunDateFormatted: sub.nextRunDate ? formatDateOnly(sub.nextRunDate) : null,
});

export const listSubscriptions = async (userId: string) => {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: { not: SubscriptionStatus.CANCELLED } },
    include: { address: true, timeSlot: true },
    orderBy: { createdAt: 'desc' },
  });
  return subs.map(withFormatting);
};

export const getSubscription = async (id: string, userId: string) => {
  const sub = await prisma.subscription.findFirst({
    where: { id, userId },
    include: { address: true, timeSlot: true, bookings: { take: 10, orderBy: { createdAt: 'desc' } } },
  });
  if (!sub) throw new NotFoundError('Subscription');
  return withFormatting(sub);
};

export const updateSubscription = async (
  id: string,
  userId: string,
  input: Partial<{ daysOfWeek: number[]; timeSlotId: string; addressId: string; status: SubscriptionStatus }>,
) => {
  const sub = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!sub) throw new NotFoundError('Subscription');
  if (sub.status === SubscriptionStatus.CANCELLED) {
    throw new ConflictError('This subscription has been cancelled', 'SUBSCRIPTION_CANCELLED');
  }

  if (input.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: input.addressId, userId, deletedAt: null },
    });
    if (!address) throw new NotFoundError('Address');
    await assertServiceable(address.area, address.city);
  }

  // Changing the schedule invalidates the pending run date.
  const daysChanged = input.daysOfWeek && input.daysOfWeek.length > 0;
  const nextRunDate = daysChanged
    ? nextMatchingDate(businessToday(), input.daysOfWeek!)
    : undefined;

  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      ...(input.daysOfWeek ? { daysOfWeek: input.daysOfWeek } : {}),
      ...(input.timeSlotId ? { timeSlotId: input.timeSlotId } : {}),
      ...(input.addressId ? { addressId: input.addressId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(nextRunDate !== undefined ? { nextRunDate } : {}),
      // Resuming from PAUSED needs a fresh run date.
      ...(input.status === SubscriptionStatus.ACTIVE && !daysChanged
        ? { nextRunDate: nextMatchingDate(businessToday(), sub.daysOfWeek) }
        : {}),
    },
    include: { address: true, timeSlot: true },
  });

  return withFormatting(updated);
};

export const cancelSubscription = async (id: string, userId: string) => {
  const sub = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!sub) throw new NotFoundError('Subscription');

  const updated = await prisma.subscription.update({
    where: { id },
    data: { status: SubscriptionStatus.CANCELLED, nextRunDate: null },
    include: { address: true, timeSlot: true },
  });

  log.info({ subscriptionId: id, userId }, 'subscription cancelled');
  return withFormatting(updated);
};

/**
 * Materialises the next booking for one subscription.
 *
 * Generated bookings start at PENDING_PAYMENT: automated recurring billing is
 * explicitly a future feature (prd.md §37), so the customer still pays per
 * occurrence. Returns null when nothing was due.
 */
export const generateNextBooking = async (subscriptionId: string): Promise<string | null> => {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { address: true, timeSlot: true },
  });

  if (!sub || sub.status !== SubscriptionStatus.ACTIVE || !sub.nextRunDate) return null;

  const runDate = formatDateOnly(sub.nextRunDate);

  // Only generate once the date is actually near — no point creating a booking
  // three weeks early.
  if (dayjs.utc(runDate, 'YYYY-MM-DD').isAfter(dayjs.utc(businessToday(), 'YYYY-MM-DD').add(3, 'day'))) {
    return null;
  }

  // Never double-generate for the same date.
  const existing = await prisma.booking.findFirst({
    where: { subscriptionId, scheduledDate: sub.nextRunDate },
    select: { id: true },
  });
  if (existing) {
    await advanceSchedule(sub, runDate);
    return null;
  }

  const capacity = await prisma.booking.count({
    where: {
      timeSlotId: sub.timeSlotId,
      scheduledDate: sub.nextRunDate,
      status: { in: OCCUPYING_STATUSES },
    },
  });

  if (capacity >= sub.timeSlot.maxBookings) {
    // Skip this occurrence rather than overbooking the route; the customer
    // keeps their subscription and gets the next one.
    log.warn({ subscriptionId, runDate }, 'slot full — skipping subscription occurrence');
    await advanceSchedule(sub, runDate);
    return null;
  }

  const booking = await prisma.booking.create({
    data: {
      reference: generateBookingReference(sub.serviceType),
      userId: sub.userId,
      serviceType: sub.serviceType,
      addressId: sub.addressId,
      serviceAreaId: sub.address.serviceAreaId,
      scheduledDate: sub.nextRunDate,
      timeSlotId: sub.timeSlotId,
      status: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
      subtotal: sub.amount,
      serviceFee: 0,
      discount: 0,
      totalAmount: sub.amount,
      currency: sub.currency,
      subscriptionId: sub.id,
      notes: 'Generated from a recurring subscription',
      ...(sub.serviceType === ServiceType.WASTE_COLLECTION
        ? {
            wasteBooking: {
              create: {
                wasteTypes: sub.wasteTypes,
                collectionSize: sub.collectionSize ?? 'MEDIUM',
              },
            },
          }
        : {}),
      statusHistory: {
        create: { newStatus: BookingStatus.PENDING_PAYMENT, reason: 'Created by subscription' },
      },
    },
  });

  await advanceSchedule(sub, runDate);

  log.info({ subscriptionId, bookingId: booking.id, runDate }, 'subscription booking generated');
  return booking.id;
};

const advanceSchedule = async (sub: Subscription, ranOn: string): Promise<void> => {
  const next = computeNextRunDate(sub, ranOn);
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      nextRunDate: next,
      lastRunAt: new Date(),
      ...(next ? {} : { status: SubscriptionStatus.EXPIRED }),
    },
  });
};

/** The daily sweep: every active subscription due on or before today. */
export const runDueSubscriptions = async (): Promise<{ generated: number; scanned: number }> => {
  const horizon = toDateOnly(dayjs.utc(businessToday(), 'YYYY-MM-DD').add(3, 'day').format('YYYY-MM-DD'));

  const due = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      nextRunDate: { not: null, lte: horizon },
    },
    select: { id: true },
    take: 500,
  });

  let generated = 0;
  for (const sub of due) {
    try {
      const bookingId = await generateNextBooking(sub.id);
      if (bookingId) generated += 1;
    } catch (err) {
      // One bad subscription must not stop the sweep.
      log.error({ err, subscriptionId: sub.id }, 'failed to generate subscription booking');
    }
  }

  return { generated, scanned: due.length };
};
