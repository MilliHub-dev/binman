import { BookingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../lib/errors';

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
