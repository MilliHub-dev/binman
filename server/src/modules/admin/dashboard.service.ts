import { BookingStatus, DriverAvailability, PaymentStatus, ServiceType, TruckStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { formatMoney } from '../../lib/money';
import { businessToday, dayjs, toDateOnly } from '../../lib/datetime';
import { ACTIVE_STATUSES } from '../bookings/booking.status';

/**
 * The numbers on the admin home screen (admin.md §1, ui.md §45).
 *
 * Revenue is summed from SUCCESSFUL payments rather than booking totals — an
 * unpaid or refunded booking is not revenue.
 */
export const getDashboard = async () => {
  const today = toDateOnly(businessToday());
  const monthStart = toDateOnly(dayjs.utc(businessToday(), 'YYYY-MM-DD').startOf('month').format('YYYY-MM-DD'));

  const [
    totalCustomers,
    todaysBookings,
    pendingPickups,
    completedToday,
    failedToday,
    activeDrivers,
    activeTrucks,
    todayRevenue,
    monthRevenue,
    cleaningBookings,
    unassignedCount,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER', status: { not: 'DELETED' } } }),
    prisma.booking.count({ where: { scheduledDate: today } }),
    prisma.booking.count({ where: { scheduledDate: today, status: { in: ACTIVE_STATUSES } } }),
    prisma.booking.count({ where: { scheduledDate: today, status: BookingStatus.COMPLETED } }),
    prisma.booking.count({ where: { scheduledDate: today, status: BookingStatus.FAILED } }),
    prisma.driver.count({
      where: { availabilityStatus: { in: [DriverAvailability.AVAILABLE, DriverAvailability.BUSY] } },
    }),
    prisma.truck.count({
      where: { status: { in: [TruckStatus.AVAILABLE, TruckStatus.ASSIGNED, TruckStatus.ON_ROUTE] } },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESSFUL, paidAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESSFUL, paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.booking.count({ where: { serviceType: ServiceType.CLEANING, scheduledDate: today } }),
    prisma.booking.count({ where: { status: BookingStatus.PENDING_ASSIGNMENT } }),
  ]);

  const todayTotal = todayRevenue._sum.amount ?? 0;
  const monthTotal = monthRevenue._sum.amount ?? 0;

  return {
    date: businessToday(),
    customers: { total: totalCustomers },
    bookings: {
      today: todaysBookings,
      pending: pendingPickups,
      completed: completedToday,
      failed: failedToday,
      cleaning: cleaningBookings,
      awaitingDispatch: unassignedCount,
    },
    fleet: { activeDrivers, activeTrucks },
    revenue: {
      today: todayTotal,
      month: monthTotal,
      formatted: { today: formatMoney(todayTotal), month: formatMoney(monthTotal) },
    },
  };
};

/** Live operations board — counts by status for today (admin.md §2). */
export const getLiveOperations = async () => {
  const today = toDateOnly(businessToday());

  const grouped = await prisma.booking.groupBy({
    by: ['status'],
    where: { scheduledDate: today },
    _count: { _all: true },
  });

  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));

  return {
    date: businessToday(),
    statuses: Object.values(BookingStatus).map((status) => ({
      status,
      count: counts[status] ?? 0,
    })),
  };
};

/**
 * Map layer: everything that has a position right now (prd.md §30).
 */
export const getMapData = async () => {
  const today = toDateOnly(businessToday());

  const [drivers, trucks, bookings] = await Promise.all([
    prisma.driver.findMany({
      where: { currentLatitude: { not: null }, currentLongitude: { not: null } },
      select: {
        id: true,
        availabilityStatus: true,
        currentLatitude: true,
        currentLongitude: true,
        lastLocationAt: true,
        user: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.truck.findMany({
      where: { currentLatitude: { not: null }, currentLongitude: { not: null } },
      select: {
        id: true,
        truckNumber: true,
        status: true,
        currentLatitude: true,
        currentLongitude: true,
      },
    }),
    prisma.booking.findMany({
      where: { scheduledDate: today },
      select: {
        id: true,
        reference: true,
        status: true,
        serviceType: true,
        address: { select: { latitude: true, longitude: true, area: true, addressLine: true } },
      },
    }),
  ]);

  return {
    drivers: drivers.map((d) => ({
      id: d.id,
      name: [d.user.firstName, d.user.lastName].filter(Boolean).join(' ') || null,
      phone: d.user.phone,
      status: d.availabilityStatus,
      latitude: d.currentLatitude,
      longitude: d.currentLongitude,
      lastSeen: d.lastLocationAt,
    })),
    trucks,
    pickups: bookings
      .filter((b) => b.address.latitude !== null && b.address.longitude !== null)
      .map((b) => ({
        id: b.id,
        reference: b.reference,
        status: b.status,
        serviceType: b.serviceType,
        latitude: b.address.latitude,
        longitude: b.address.longitude,
        area: b.address.area,
        addressLine: b.address.addressLine,
      })),
  };
};
