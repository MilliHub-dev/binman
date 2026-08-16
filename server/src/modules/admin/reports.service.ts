import { BookingStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { formatMoney } from '../../lib/money';
import { formatDateOnly, toDateOnly } from '../../lib/datetime';

/**
 * Reporting (admin.md §8). Everything is bounded by an explicit date range so a
 * report can never accidentally scan the whole table.
 */

interface Range {
  from: string;
  to: string;
}

const rangeFilter = ({ from, to }: Range) => ({
  gte: toDateOnly(from),
  lte: toDateOnly(to),
});

export const revenueReport = async (range: Range) => {
  const [payments, byService] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCESSFUL,
        paidAt: { gte: toDateOnly(range.from), lte: toDateOnly(range.to) },
      },
      _sum: { amount: true },
      _count: { _all: true },
      _avg: { amount: true },
    }),
    prisma.booking.groupBy({
      by: ['serviceType'],
      where: {
        scheduledDate: rangeFilter(range),
        paymentStatus: PaymentStatus.SUCCESSFUL,
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  const total = payments._sum.amount ?? 0;
  const average = Math.round(payments._avg.amount ?? 0);

  return {
    range,
    totalRevenue: total,
    totalRevenueFormatted: formatMoney(total),
    transactionCount: payments._count._all,
    averageTransaction: average,
    averageTransactionFormatted: formatMoney(average),
    byService: byService.map((row) => ({
      serviceType: row.serviceType,
      revenue: row._sum.totalAmount ?? 0,
      revenueFormatted: formatMoney(row._sum.totalAmount ?? 0),
      bookings: row._count._all,
    })),
  };
};

export const bookingsReport = async (range: Range) => {
  const [byStatus, byService, byArea, total] = await Promise.all([
    prisma.booking.groupBy({
      by: ['status'],
      where: { scheduledDate: rangeFilter(range) },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ['serviceType'],
      where: { scheduledDate: rangeFilter(range) },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ['serviceAreaId'],
      where: { scheduledDate: rangeFilter(range) },
      _count: { _all: true },
    }),
    prisma.booking.count({ where: { scheduledDate: rangeFilter(range) } }),
  ]);

  const areaIds = byArea.map((a) => a.serviceAreaId).filter((id): id is string => Boolean(id));
  const areas = await prisma.serviceArea.findMany({
    where: { id: { in: areaIds } },
    select: { id: true, name: true, city: true },
  });
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const completed = byStatus.find((s) => s.status === BookingStatus.COMPLETED)?._count._all ?? 0;
  const failed = byStatus.find((s) => s.status === BookingStatus.FAILED)?._count._all ?? 0;
  const cancelled = byStatus.find((s) => s.status === BookingStatus.CANCELLED)?._count._all ?? 0;

  return {
    range,
    total,
    completed,
    failed,
    cancelled,
    // Completion rate excludes cancellations — a customer cancelling is not an
    // operational failure.
    completionRate: total - cancelled > 0 ? Number(((completed / (total - cancelled)) * 100).toFixed(1)) : 0,
    byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    byService: byService.map((row) => ({ serviceType: row.serviceType, count: row._count._all })),
    byArea: byArea.map((row) => ({
      serviceAreaId: row.serviceAreaId,
      name: row.serviceAreaId ? (areaById.get(row.serviceAreaId)?.name ?? 'Unknown') : 'Unassigned',
      count: row._count._all,
    })),
  };
};

/** Driver utilisation — jobs handled, completed and failed per driver. */
export const driverPerformanceReport = async (range: Range) => {
  const assignments = await prisma.bookingAssignment.groupBy({
    by: ['driverId', 'status'],
    where: {
      booking: { scheduledDate: rangeFilter(range) },
      driverId: { not: null },
    },
    _count: { _all: true },
  });

  const driverIds = [...new Set(assignments.map((a) => a.driverId).filter((id): id is string => Boolean(id)))];

  const drivers = await prisma.driver.findMany({
    where: { id: { in: driverIds } },
    select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } },
  });

  return {
    range,
    drivers: drivers.map((driver) => {
      const rows = assignments.filter((a) => a.driverId === driver.id);
      const totalJobs = rows.reduce((sum, r) => sum + r._count._all, 0);
      const completed = rows.find((r) => r.status === 'COMPLETED')?._count._all ?? 0;
      const failed = rows.find((r) => r.status === 'FAILED')?._count._all ?? 0;

      return {
        driverId: driver.id,
        name: [driver.user.firstName, driver.user.lastName].filter(Boolean).join(' ') || null,
        phone: driver.user.phone,
        totalJobs,
        completed,
        failed,
        completionRate: totalJobs > 0 ? Number(((completed / totalJobs) * 100).toFixed(1)) : 0,
      };
    }),
  };
};

export const subscriptionReport = async () => {
  const [byStatus, revenue] = await Promise.all([
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.subscription.aggregate({ where: { status: 'ACTIVE' }, _sum: { amount: true } }),
  ]);

  const recurring = revenue._sum.amount ?? 0;

  return {
    byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    /** Per-occurrence value of all active subscriptions, not annualised. */
    activeRecurringValue: recurring,
    activeRecurringValueFormatted: formatMoney(recurring),
  };
};

/**
 * Flat rows for CSV/Excel export (admin.md §8). Capped so an export cannot
 * exhaust memory; the caller narrows the range if it hits the cap.
 */
export const EXPORT_ROW_LIMIT = 5000;

export const exportBookings = async (range: Range) => {
  const bookings = await prisma.booking.findMany({
    where: { scheduledDate: rangeFilter(range) },
    take: EXPORT_ROW_LIMIT,
    orderBy: { scheduledDate: 'asc' },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
      address: { select: { area: true, city: true, addressLine: true } },
      timeSlot: { select: { label: true } },
      wasteBooking: true,
      assignments: {
        where: { status: { notIn: ['REASSIGNED', 'CANCELLED'] } },
        take: 1,
        orderBy: { assignedAt: 'desc' },
        include: { driver: { select: { user: { select: { firstName: true, lastName: true } } } } },
      },
    },
  });

  const rows = bookings.map((b) => ({
    reference: b.reference,
    date: formatDateOnly(b.scheduledDate),
    timeSlot: b.timeSlot.label,
    serviceType: b.serviceType,
    status: b.status,
    paymentStatus: b.paymentStatus,
    customer: [b.user.firstName, b.user.lastName].filter(Boolean).join(' '),
    phone: b.user.phone,
    area: b.address.area,
    city: b.address.city,
    address: b.address.addressLine,
    collectionSize: b.wasteBooking?.collectionSize ?? '',
    wasteTypes: b.wasteBooking?.wasteTypes.join('|') ?? '',
    driver:
      [b.assignments[0]?.driver?.user.firstName, b.assignments[0]?.driver?.user.lastName]
        .filter(Boolean)
        .join(' ') || '',
    // Exported in Naira, not kobo — spreadsheets are read by humans.
    subtotal: (b.subtotal / 100).toFixed(2),
    serviceFee: (b.serviceFee / 100).toFixed(2),
    total: (b.totalAmount / 100).toFixed(2),
    currency: b.currency,
    createdAt: b.createdAt.toISOString(),
  }));

  return { rows, truncated: rows.length === EXPORT_ROW_LIMIT, limit: EXPORT_ROW_LIMIT };
};

/** Minimal RFC 4180 CSV serialisation. */
export const toCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\r\n');
};
