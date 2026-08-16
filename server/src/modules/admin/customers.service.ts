import { PaymentStatus, Role, UserStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import { buildMeta, toSkipTake, type PaginationInput } from '../../lib/pagination';
import { formatMoney } from '../../lib/money';
import { recordAudit } from '../../lib/audit';
import { toPublicUser } from '../users/user.mapper';

/** Customer management (admin.md §5). */
export const listCustomers = async (
  pagination: PaginationInput,
  filters: { search?: string; status?: UserStatus } = {},
) => {
  const where: Prisma.UserWhereInput = {
    role: Role.CUSTOMER,
    ...(filters.status ? { status: filters.status } : { status: { not: UserStatus.DELETED } }),
    ...(filters.search
      ? {
          OR: [
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { _count: { select: { bookings: true, addresses: true, subscriptions: true } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map((user) => ({
      ...toPublicUser(user),
      counts: user._count,
    })),
    meta: buildMeta(total, pagination),
  };
};

/** The full customer record a support agent needs on one screen. */
export const getCustomer = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      addresses: { where: { deletedAt: null } },
      bookings: {
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          serviceType: true,
          status: true,
          scheduledDate: true,
          totalAmount: true,
          paymentStatus: true,
        },
      },
      subscriptions: { include: { timeSlot: true, address: true } },
      payments: { take: 25, orderBy: { createdAt: 'desc' } },
      supportTickets: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!user) throw new NotFoundError('Customer');

  const spend = await prisma.payment.aggregate({
    where: { userId, status: PaymentStatus.SUCCESSFUL },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const lifetimeValue = spend._sum.amount ?? 0;

  return {
    ...toPublicUser(user),
    addresses: user.addresses,
    recentBookings: user.bookings,
    subscriptions: user.subscriptions,
    recentPayments: user.payments,
    supportTickets: user.supportTickets,
    lifetimeValue,
    lifetimeValueFormatted: formatMoney(lifetimeValue),
    successfulPayments: spend._count._all,
  };
};

/**
 * Suspends or reactivates an account. Suspension also revokes every session,
 * so access ends immediately rather than when the access token expires.
 */
export const setCustomerStatus = async (userId: string, status: UserStatus, actorId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('Customer');

  const updated = await prisma.$transaction(async (tx) => {
    if (status === UserStatus.SUSPENDED || status === UserStatus.DELETED) {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return tx.user.update({ where: { id: userId }, data: { status } });
  });

  void recordAudit({
    userId: actorId,
    action: 'CUSTOMER_STATUS_CHANGED',
    entity: 'User',
    entityId: userId,
    oldData: { status: user.status },
    newData: { status },
  });

  return toPublicUser(updated);
};
