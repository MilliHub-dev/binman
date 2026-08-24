/**
 * Sets up the account App Store and Play Store reviewers sign into.
 *
 *   npm run seed:demo
 *
 * A reviewer who signs in to an empty app cannot tell a working product from a
 * broken one, and "we could not evaluate the app's functionality" is a common
 * rejection. So this creates a customer with a saved address and a spread of
 * bookings — one finished, one on the way, one upcoming — plus a weekly plan,
 * so every screen has something real on it.
 *
 * Safe to run repeatedly: it works from a fixed phone number and replaces that
 * account's demo data rather than accumulating it.
 */
import { BookingStatus, PaymentStatus, Role, ServiceType, UserStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';
import { normalisePhone } from '../src/lib/phone';
import { generateBookingReference } from '../src/lib/reference';
import { businessToday, toDateOnly } from '../src/lib/datetime';

const main = async () => {
  if (!env.DEMO_PHONE) {
    console.error('DEMO_PHONE is not set. Add DEMO_PHONE and DEMO_OTP first.');
    process.exit(1);
  }

  const phone = normalisePhone(env.DEMO_PHONE);

  const user = await prisma.user.upsert({
    where: { phone },
    update: { firstName: 'App', lastName: 'Reviewer', status: UserStatus.ACTIVE },
    create: {
      phone,
      firstName: 'App',
      lastName: 'Reviewer',
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  const area = await prisma.serviceArea.findFirst({ where: { isActive: true } });
  const slot = await prisma.timeSlot.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });

  if (!area || !slot) {
    console.error('No service areas or time slots found. Run `npm run seed` first.');
    process.exit(1);
  }

  // Start from a clean slate so repeated runs do not pile up bookings.
  await prisma.booking.deleteMany({ where: { userId: user.id } });
  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.address.deleteMany({ where: { userId: user.id } });

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      label: 'Home',
      addressLine: '12 Udo Udoma Avenue',
      area: area.name,
      city: area.city,
      state: area.state,
      latitude: 5.0378,
      longitude: 7.9128,
      instructions: 'Blue gate, opposite the pharmacy.',
      serviceAreaId: area.id,
      isDefault: true,
    },
  });

  const today = businessToday();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return toDateOnly(d);
  };

  /** One of each state a reviewer might want to look at. */
  const bookings = [
    { status: BookingStatus.COMPLETED, payment: PaymentStatus.SUCCESSFUL, date: day(-3) },
    { status: BookingStatus.DRIVER_EN_ROUTE, payment: PaymentStatus.SUCCESSFUL, date: day(0) },
    { status: BookingStatus.PENDING_ASSIGNMENT, payment: PaymentStatus.SUCCESSFUL, date: day(2) },
  ];

  for (const b of bookings) {
    await prisma.booking.create({
      data: {
        reference: generateBookingReference(ServiceType.WASTE_COLLECTION),
        userId: user.id,
        serviceType: ServiceType.WASTE_COLLECTION,
        addressId: address.id,
        serviceAreaId: area.id,
        scheduledDate: b.date,
        timeSlotId: slot.id,
        status: b.status,
        paymentStatus: b.payment,
        subtotal: 250_000,
        serviceFee: 50_000,
        totalAmount: 300_000,
        ...(b.status === BookingStatus.COMPLETED ? { completedAt: new Date() } : {}),
        wasteBooking: { create: { wasteTypes: ['HOUSEHOLD'], collectionSize: 'MEDIUM' } },
        statusHistory: { create: { newStatus: b.status, reason: 'Demo data' } },
      },
    });
  }

  await prisma.subscription.create({
    data: {
      userId: user.id,
      serviceType: ServiceType.WASTE_COLLECTION,
      frequency: 'WEEKLY',
      daysOfWeek: [2, 5],
      timeSlotId: slot.id,
      addressId: address.id,
      amount: 300_000,
      wasteTypes: ['HOUSEHOLD'],
      collectionSize: 'MEDIUM',
      status: 'ACTIVE',
      startDate: new Date(),
    },
  });

  console.log(`\nStore-review account ready\n`);
  console.log(`  phone : ${env.DEMO_PHONE}`);
  console.log(`  code  : ${env.DEMO_OTP}`);
  console.log(`  data  : 1 address, ${bookings.length} bookings, 1 weekly plan\n`);
};

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
