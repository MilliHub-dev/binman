import bcrypt from 'bcryptjs';
import {
  CollectionSize,
  DriverAvailability,
  PrismaClient,
  Role,
  ServiceType,
  TruckStatus,
  UserStatus,
  VerificationStatus,
  WasteType,
  CleaningType,
  PropertySize,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the configuration the platform cannot run without: operating areas,
 * time slots and pricing. Without pricing rules, every booking fails with
 * NO_PRICE_CONFIGURED by design.
 *
 * Idempotent — safe to re-run.
 *
 *   npm run seed
 *
 * All prices are in kobo. ₦2,500 => 250000.
 */

/**
 * Operating areas for the Uyo launch (Akwa Ibom State).
 *
 * This is a starting list of well-known Uyo districts — CONFIRM it against the
 * routes you actually run before going live, and add or retire areas from the
 * admin dashboard rather than editing this file.
 *
 * Surcharges are all zero here on purpose: which areas cost more to reach is an
 * operational fact about your fleet, not something to guess at in a seed.
 * Itam is left as the one worked example because it sits furthest out.
 */
const SERVICE_AREAS = [
  { name: 'Ewet Housing Estate', city: 'Uyo', state: 'Akwa Ibom', surcharge: 0 },
  { name: 'Shelter Afrique', city: 'Uyo', state: 'Akwa Ibom', surcharge: 0 },
  { name: 'Osongama Estate', city: 'Uyo', state: 'Akwa Ibom', surcharge: 0 },
  { name: 'Aka Road', city: 'Uyo', state: 'Akwa Ibom', surcharge: 0 },
  { name: 'Oron Road', city: 'Uyo', state: 'Akwa Ibom', surcharge: 0 },
  { name: 'Nwaniba Road', city: 'Uyo', state: 'Akwa Ibom', surcharge: 0 },
  { name: 'Ikot Ekpene Road', city: 'Uyo', state: 'Akwa Ibom', surcharge: 0 },
  { name: 'Abak Road', city: 'Uyo', state: 'Akwa Ibom', surcharge: 0 },
  { name: 'Itam', city: 'Uyo', state: 'Akwa Ibom', surcharge: 25_000 },
];

/** The windows from prd.md §13, as minutes from midnight. */
const TIME_SLOTS = [
  { label: '7:00 AM – 9:00 AM', startTime: 420, endTime: 540, sortOrder: 1, maxBookings: 25 },
  { label: '9:00 AM – 11:00 AM', startTime: 540, endTime: 660, sortOrder: 2, maxBookings: 25 },
  { label: '11:00 AM – 1:00 PM', startTime: 660, endTime: 780, sortOrder: 3, maxBookings: 25 },
  { label: '1:00 PM – 3:00 PM', startTime: 780, endTime: 900, sortOrder: 4, maxBookings: 20 },
];

/** Baseline nationwide pricing. Operations tunes these from the dashboard. */
const WASTE_PRICING = [
  { collectionSize: CollectionSize.SMALL, basePrice: 150_000 },
  { collectionSize: CollectionSize.MEDIUM, basePrice: 250_000 },
  { collectionSize: CollectionSize.LARGE, basePrice: 400_000 },
  { collectionSize: CollectionSize.EXTRA_LARGE, basePrice: 650_000 },
];

/** Commercial waste is priced above household at the same size. */
const COMMERCIAL_PRICING = [
  { collectionSize: CollectionSize.SMALL, basePrice: 250_000 },
  { collectionSize: CollectionSize.MEDIUM, basePrice: 400_000 },
  { collectionSize: CollectionSize.LARGE, basePrice: 650_000 },
  { collectionSize: CollectionSize.EXTRA_LARGE, basePrice: 950_000 },
];

const CLEANING_PRICING = [
  { cleaningType: CleaningType.REGULAR, propertySize: PropertySize.ONE_BEDROOM, basePrice: 800_000 },
  { cleaningType: CleaningType.REGULAR, propertySize: PropertySize.TWO_BEDROOM, basePrice: 1_200_000 },
  { cleaningType: CleaningType.REGULAR, propertySize: PropertySize.THREE_BEDROOM, basePrice: 1_600_000 },
  { cleaningType: CleaningType.DEEP, propertySize: PropertySize.TWO_BEDROOM, basePrice: 2_000_000 },
  { cleaningType: CleaningType.DEEP, propertySize: PropertySize.THREE_BEDROOM, basePrice: 2_800_000 },
];

const TRUCKS = [
  { truckNumber: 'TRK-001', registrationNumber: 'UYO-101-XA', truckType: 'Compactor', capacity: '5 tonnes' },
  { truckNumber: 'TRK-002', registrationNumber: 'UYO-102-XA', truckType: 'Tipper', capacity: '3 tonnes' },
  { truckNumber: 'TRK-003', registrationNumber: 'UYO-103-XA', truckType: 'Open truck', capacity: '2 tonnes' },
];

const seedServiceAreas = async () => {
  for (const area of SERVICE_AREAS) {
    await prisma.serviceArea.upsert({
      where: { city_name: { city: area.city, name: area.name } },
      create: area,
      update: { surcharge: area.surcharge, isActive: true },
    });
  }
  console.log(`  service areas: ${SERVICE_AREAS.length}`);
};

const seedTimeSlots = async () => {
  for (const slot of TIME_SLOTS) {
    const existing = await prisma.timeSlot.findFirst({ where: { label: slot.label } });
    if (existing) {
      await prisma.timeSlot.update({ where: { id: existing.id }, data: slot });
    } else {
      await prisma.timeSlot.create({ data: slot });
    }
  }
  console.log(`  time slots: ${TIME_SLOTS.length}`);
};

const seedPricing = async () => {
  let count = 0;

  // Wildcard waste rules — any waste type, priced by size.
  for (const rule of WASTE_PRICING) {
    const existing = await prisma.pricingRule.findFirst({
      where: {
        serviceType: ServiceType.WASTE_COLLECTION,
        wasteType: null,
        collectionSize: rule.collectionSize,
        serviceAreaId: null,
      },
    });
    if (!existing) {
      await prisma.pricingRule.create({
        data: {
          serviceType: ServiceType.WASTE_COLLECTION,
          collectionSize: rule.collectionSize,
          basePrice: rule.basePrice,
          serviceFee: 50_000,
        },
      });
      count += 1;
    }
  }

  // More specific rules for commercial waste win over the wildcards above.
  for (const rule of COMMERCIAL_PRICING) {
    const existing = await prisma.pricingRule.findFirst({
      where: {
        serviceType: ServiceType.WASTE_COLLECTION,
        wasteType: WasteType.COMMERCIAL,
        collectionSize: rule.collectionSize,
        serviceAreaId: null,
      },
    });
    if (!existing) {
      await prisma.pricingRule.create({
        data: {
          serviceType: ServiceType.WASTE_COLLECTION,
          wasteType: WasteType.COMMERCIAL,
          collectionSize: rule.collectionSize,
          basePrice: rule.basePrice,
          serviceFee: 50_000,
        },
      });
      count += 1;
    }
  }

  for (const rule of CLEANING_PRICING) {
    const existing = await prisma.pricingRule.findFirst({
      where: {
        serviceType: ServiceType.CLEANING,
        cleaningType: rule.cleaningType,
        propertySize: rule.propertySize,
        serviceAreaId: null,
      },
    });
    if (!existing) {
      await prisma.pricingRule.create({
        data: {
          serviceType: ServiceType.CLEANING,
          cleaningType: rule.cleaningType,
          propertySize: rule.propertySize,
          basePrice: rule.basePrice,
          serviceFee: 100_000,
        },
      });
      count += 1;
    }
  }

  console.log(`  pricing rules created: ${count}`);
};

const seedTrucks = async () => {
  for (const truck of TRUCKS) {
    await prisma.truck.upsert({
      where: { truckNumber: truck.truckNumber },
      create: { ...truck, status: TruckStatus.AVAILABLE },
      update: {},
    });
  }
  console.log(`  trucks: ${TRUCKS.length}`);
};

/**
 * Bootstrap credentials for the admin console.
 *
 * Overridable by environment so a real deployment never has to ship the
 * default. `mustChangePassword` is set on the seeded account, so whoever signs
 * in first is forced to replace this before they can do anything.
 */
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'admin@binman.com').toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123dev';

const seedStaff = async () => {
  // Staff sign in to the admin console with email + password. The phone number
  // is still here so the same person can use the driver app or WhatsApp.
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { phone: '+2348000000001' },
    create: {
      phone: '+2348000000001',
      firstName: 'BinMan',
      lastName: 'Admin',
      email: ADMIN_EMAIL,
      passwordHash,
      // Forces a change on first sign-in — a seeded password is a known one.
      mustChangePassword: true,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    update: {
      email: ADMIN_EMAIL,
      passwordHash,
      mustChangePassword: true,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const dispatcher = await prisma.user.upsert({
    where: { phone: '+2348000000002' },
    create: {
      phone: '+2348000000002',
      firstName: 'Mfon',
      lastName: 'Akpan',
      email: 'dispatch@binman.com',
      passwordHash,
      mustChangePassword: true,
      role: Role.DISPATCHER,
      status: UserStatus.ACTIVE,
    },
    update: {
      email: 'dispatch@binman.com',
      passwordHash,
      mustChangePassword: true,
      role: Role.DISPATCHER,
    },
  });

  const driverUser = await prisma.user.upsert({
    where: { phone: '+2348000000003' },
    create: {
      phone: '+2348000000003',
      firstName: 'Aniekan',
      lastName: 'Udo',
      role: Role.DRIVER,
      status: UserStatus.ACTIVE,
    },
    update: { role: Role.DRIVER },
  });

  const truck = await prisma.truck.findUnique({ where: { truckNumber: 'TRK-001' } });

  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    create: {
      userId: driverUser.id,
      licenseNumber: 'AKS-DRV-00123',
      verificationStatus: VerificationStatus.VERIFIED,
      availabilityStatus: DriverAvailability.AVAILABLE,
      defaultTruckId: truck?.id ?? null,
    },
    update: { verificationStatus: VerificationStatus.VERIFIED },
  });

  console.log(`  staff: ${admin.email} (SUPER_ADMIN), ${dispatcher.email} (DISPATCHER)`);
  console.log(`  driver: ${driverUser.phone} (OTP, driver app)`);
};

const main = async () => {
  console.log('Seeding BinMan…');
  await seedServiceAreas();
  await seedTimeSlots();
  await seedPricing();
  await seedTrucks();
  await seedStaff();
  console.log('Done.');
  console.log('\nAdmin console: sign in at /login with');
  console.log(`  email:    ${ADMIN_EMAIL}`);
  console.log(`  password: ${ADMIN_PASSWORD}`);
  console.log('You will be asked to change it on first sign-in.');
  console.log('\nDriver app / mobile: OTP on +2348000000003 (debug code returned in dev).');
};

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
