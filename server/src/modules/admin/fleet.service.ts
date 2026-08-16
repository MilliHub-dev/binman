import {
  DriverAvailability,
  Role,
  TruckStatus,
  UserStatus,
  VerificationStatus,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { buildMeta, toSkipTake, type PaginationInput } from '../../lib/pagination';
import { normalisePhone } from '../../lib/phone';

/**
 * Driver and truck management (prd.md §27, §28).
 *
 * A driver is a User with role DRIVER plus a Driver profile. Creating one here
 * provisions both — operations staff should not have to do it in two steps.
 */

export const listDrivers = async (
  pagination: PaginationInput,
  filters: { status?: DriverAvailability; search?: string } = {},
) => {
  const where: Prisma.DriverWhereInput = {
    ...(filters.status ? { availabilityStatus: filters.status } : {}),
    ...(filters.search
      ? {
          user: {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { phone: { contains: filters.search } },
            ],
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, status: true, profileImage: true } },
        defaultTruck: { select: { id: true, truckNumber: true, registrationNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(pagination),
    }),
    prisma.driver.count({ where }),
  ]);

  return { items, meta: buildMeta(total, pagination) };
};

export const getDriver = async (driverId: string) => {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: {
      user: true,
      defaultTruck: true,
      assignments: {
        take: 20,
        orderBy: { assignedAt: 'desc' },
        include: { booking: { select: { id: true, reference: true, status: true, scheduledDate: true } } },
      },
    },
  });
  if (!driver) throw new NotFoundError('Driver');
  return driver;
};

export const createDriver = async (input: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  defaultTruckId?: string;
}) => {
  const phone = normalisePhone(input.phone);

  const existing = await prisma.user.findUnique({ where: { phone }, include: { driver: true } });
  if (existing?.driver) {
    throw new ConflictError('A driver already exists for this phone number', 'DRIVER_EXISTS');
  }

  return prisma.$transaction(async (tx) => {
    // Promote an existing customer rather than creating a duplicate identity.
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            role: Role.DRIVER,
            firstName: input.firstName,
            lastName: input.lastName,
            ...(input.email ? { email: input.email } : {}),
          },
        })
      : await tx.user.create({
          data: {
            phone,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email ?? null,
            role: Role.DRIVER,
            status: UserStatus.ACTIVE,
          },
        });

    return tx.driver.create({
      data: {
        userId: user.id,
        licenseNumber: input.licenseNumber ?? null,
        licenseExpiry: input.licenseExpiry ?? null,
        defaultTruckId: input.defaultTruckId ?? null,
        verificationStatus: VerificationStatus.PENDING,
        availabilityStatus: DriverAvailability.OFFLINE,
      },
      include: { user: true },
    });
  });
};

export const updateDriver = async (
  driverId: string,
  input: {
    firstName?: string;
    lastName?: string;
    email?: string;
    licenseNumber?: string;
    licenseExpiry?: Date | null;
    verificationStatus?: VerificationStatus;
    availabilityStatus?: DriverAvailability;
    defaultTruckId?: string | null;
  },
) => {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new NotFoundError('Driver');

  return prisma.$transaction(async (tx) => {
    if (input.firstName || input.lastName || input.email) {
      await tx.user.update({
        where: { id: driver.userId },
        data: {
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          ...(input.email ? { email: input.email } : {}),
        },
      });
    }

    return tx.driver.update({
      where: { id: driverId },
      data: {
        ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber } : {}),
        ...(input.licenseExpiry !== undefined ? { licenseExpiry: input.licenseExpiry } : {}),
        ...(input.verificationStatus ? { verificationStatus: input.verificationStatus } : {}),
        ...(input.availabilityStatus ? { availabilityStatus: input.availabilityStatus } : {}),
        ...(input.defaultTruckId !== undefined ? { defaultTruckId: input.defaultTruckId } : {}),
      },
      include: { user: true },
    });
  });
};

/**
 * Suspends a driver and signs them out. Refuses while work is still open, so a
 * job never ends up owned by an account that cannot act on it.
 */
export const suspendDriver = async (driverId: string) => {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new NotFoundError('Driver');

  const openJobs = await prisma.bookingAssignment.count({
    where: {
      driverId,
      status: { in: ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'] },
    },
  });
  if (openJobs > 0) {
    throw new ConflictError(
      `This driver still has ${openJobs} open job(s). Reassign them first.`,
      'DRIVER_HAS_OPEN_JOBS',
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: { userId: driver.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.driver.update({
      where: { id: driverId },
      data: { availabilityStatus: DriverAvailability.SUSPENDED },
    });
  });
};

// ---------------------------------------------------------------------------
// Trucks
// ---------------------------------------------------------------------------

export const listTrucks = async (
  pagination: PaginationInput,
  filters: { status?: TruckStatus; search?: string } = {},
) => {
  const where: Prisma.TruckWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { truckNumber: { contains: filters.search, mode: 'insensitive' } },
            { registrationNumber: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.truck.findMany({
      where,
      include: { defaultDrivers: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { truckNumber: 'asc' },
      ...toSkipTake(pagination),
    }),
    prisma.truck.count({ where }),
  ]);

  return { items, meta: buildMeta(total, pagination) };
};

export const createTruck = (input: {
  truckNumber: string;
  registrationNumber: string;
  truckType: string;
  capacity?: string;
  status?: TruckStatus;
}) => prisma.truck.create({ data: input });

export const updateTruck = async (
  truckId: string,
  input: Partial<{
    truckNumber: string;
    registrationNumber: string;
    truckType: string;
    capacity: string;
    status: TruckStatus;
    lastServiceDate: Date;
    nextServiceDue: Date;
    maintenanceNotes: string;
  }>,
) => {
  const truck = await prisma.truck.findUnique({ where: { id: truckId } });
  if (!truck) throw new NotFoundError('Truck');

  // Taking a truck off the road while it is mid-job would strand a collection.
  const takingOffRoad: TruckStatus[] = [TruckStatus.MAINTENANCE, TruckStatus.OUT_OF_SERVICE];
  const currentlyWorking: TruckStatus[] = [TruckStatus.ASSIGNED, TruckStatus.ON_ROUTE];

  if (input.status && takingOffRoad.includes(input.status) && currentlyWorking.includes(truck.status)) {
    const openJobs = await prisma.bookingAssignment.count({
      where: { truckId, status: { in: ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED'] } },
    });
    if (openJobs > 0) {
      throw new ConflictError(
        `This truck is assigned to ${openJobs} open job(s). Reassign them first.`,
        'TRUCK_HAS_OPEN_JOBS',
      );
    }
  }

  return prisma.truck.update({ where: { id: truckId }, data: input });
};
