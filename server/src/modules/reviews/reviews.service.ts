import { BookingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { buildMeta, toSkipTake, type PaginationInput } from '../../lib/pagination';

/**
 * Ratings and reviews (prd.md §23). A review can only be left by the customer
 * who booked, only once, and only after the job actually completed.
 */
export const createReview = async (
  userId: string,
  bookingId: string,
  input: { rating: number; comment?: string; photoUrls?: string[] },
) => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true, status: true },
  });
  if (!booking) throw new NotFoundError('Booking');

  if (booking.status !== BookingStatus.COMPLETED) {
    throw new ConflictError('You can only review a completed booking', 'BOOKING_NOT_COMPLETED');
  }

  const existing = await prisma.review.findUnique({ where: { bookingId } });
  if (existing) throw new ConflictError('You have already reviewed this booking', 'ALREADY_REVIEWED');

  return prisma.review.create({
    data: {
      bookingId,
      userId,
      rating: input.rating,
      comment: input.comment ?? null,
      photoUrls: input.photoUrls ?? [],
    },
  });
};

export const listMyReviews = (userId: string) =>
  prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { booking: { select: { id: true, reference: true, serviceType: true } } },
  });

/** Aggregate rating for the admin dashboard and service-quality reporting. */
export const getRatingSummary = async () => {
  const [aggregate, distribution] = await Promise.all([
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.groupBy({ by: ['rating'], _count: { _all: true }, orderBy: { rating: 'asc' } }),
  ]);

  return {
    average: Number((aggregate._avg.rating ?? 0).toFixed(2)),
    total: aggregate._count._all,
    distribution: [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: distribution.find((d) => d.rating === rating)?._count._all ?? 0,
    })),
  };
};

/**
 * Every review, for the back office.
 *
 * `listMyReviews` is scoped to one customer, and the summary is only counts —
 * so until now nothing could show staff what a customer actually said. An
 * average of 3.4 tells you there is a problem; the one-star comments tell you
 * which driver, which street, and what happened.
 */
export const listReviews = async (
  pagination: PaginationInput,
  filters: { rating?: number; minRating?: number; maxRating?: number } = {},
) => {
  const where = {
    ...(filters.rating ? { rating: filters.rating } : {}),
    ...(filters.minRating || filters.maxRating
      ? {
          rating: {
            ...(filters.minRating ? { gte: filters.minRating } : {}),
            ...(filters.maxRating ? { lte: filters.maxRating } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      // Newest first: a review is only actionable while the job is recent.
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        booking: {
          select: {
            id: true,
            reference: true,
            serviceType: true,
            scheduledDate: true,
            address: { select: { area: true, city: true } },
            /**
             * Cleaning is done by a cleaner (a User), waste by a driver (a
             * Driver, whose name lives on its linked user). Both are read so a
             * poor review always names whoever actually attended.
             */
            assignments: {
              orderBy: { assignedAt: 'desc' },
              take: 1,
              select: {
                driver: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
                cleaner: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      ...toSkipTake(pagination),
    }),
    prisma.review.count({ where }),
  ]);

  return {
    items: items.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      photoUrls: review.photoUrls,
      createdAt: review.createdAt,
      customer: {
        id: review.user.id,
        name: [review.user.firstName, review.user.lastName].filter(Boolean).join(' ') || null,
        phone: review.user.phone,
      },
      booking: {
        id: review.booking.id,
        reference: review.booking.reference,
        serviceType: review.booking.serviceType,
        scheduledDate: review.booking.scheduledDate,
        area: review.booking.address?.area ?? null,
        city: review.booking.address?.city ?? null,
      },
      // Who did the job — the question a one-star review immediately raises.
      attendedBy: (() => {
        const assignment = review.booking.assignments[0];
        if (assignment?.driver) {
          return {
            id: assignment.driver.id,
            role: 'DRIVER' as const,
            name:
              [assignment.driver.user.firstName, assignment.driver.user.lastName]
                .filter(Boolean)
                .join(' ') || null,
          };
        }
        if (assignment?.cleaner) {
          return {
            id: assignment.cleaner.id,
            role: 'CLEANER' as const,
            name:
              [assignment.cleaner.firstName, assignment.cleaner.lastName]
                .filter(Boolean)
                .join(' ') || null,
          };
        }
        return null;
      })(),
    })),
    meta: buildMeta(total, pagination),
  };
};
