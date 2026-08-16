import { z } from 'zod';
import {
  BookingStatus,
  DriverAvailability,
  PaymentStatus,
  ServiceType,
  TruckStatus,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { paginationQuery } from '../../lib/pagination';
import { phoneField } from '../auth/auth.schema';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const idParam = z.object({ id: z.string().min(1) });

// --- Bookings ---------------------------------------------------------------

export const adminBookingsQuery = z.object({
  ...paginationQuery,
  status: z.nativeEnum(BookingStatus).optional(),
  serviceType: z.nativeEnum(ServiceType).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  serviceAreaId: z.string().min(1).optional(),
  driverId: z.string().min(1).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const assignBookingSchema = z
  .object({
    driverId: z.string().min(1).optional(),
    truckId: z.string().min(1).optional(),
    cleanerId: z.string().min(1).optional(),
  })
  .refine((data) => data.driverId || data.cleanerId, {
    message: 'Provide a driver (waste) or a cleaner (cleaning)',
  });

export const changeStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
  reason: z.string().trim().max(500).optional(),
});

export const adminCancelSchema = z.object({
  reason: z.string().trim().min(1, 'A cancellation reason is required').max(500),
});

export const unassignSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const dispatchQuery = z.object({ date: dateOnly.optional() });

// --- Customers --------------------------------------------------------------

export const customersQuery = z.object({
  ...paginationQuery,
  search: z.string().trim().min(1).max(100).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const customerStatusSchema = z.object({
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED]),
});

// --- Drivers ----------------------------------------------------------------

export const driversQuery = z.object({
  ...paginationQuery,
  status: z.nativeEnum(DriverAvailability).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const createDriverSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: phoneField,
  email: z.string().trim().email().max(180).optional(),
  licenseNumber: z.string().trim().max(60).optional(),
  licenseExpiry: z.coerce.date().optional(),
  defaultTruckId: z.string().min(1).optional(),
});

export const updateDriverSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    email: z.string().trim().email().max(180).optional(),
    licenseNumber: z.string().trim().max(60).optional(),
    licenseExpiry: z.coerce.date().nullable().optional(),
    verificationStatus: z.nativeEnum(VerificationStatus).optional(),
    availabilityStatus: z.nativeEnum(DriverAvailability).optional(),
    defaultTruckId: z.string().min(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field' });

// --- Trucks -----------------------------------------------------------------

export const trucksQuery = z.object({
  ...paginationQuery,
  status: z.nativeEnum(TruckStatus).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const createTruckSchema = z.object({
  truckNumber: z.string().trim().min(1).max(40),
  registrationNumber: z.string().trim().min(1).max(40),
  truckType: z.string().trim().min(1).max(60),
  capacity: z.string().trim().max(60).optional(),
  status: z.nativeEnum(TruckStatus).default(TruckStatus.AVAILABLE),
});

export const updateTruckSchema = z
  .object({
    truckNumber: z.string().trim().min(1).max(40).optional(),
    registrationNumber: z.string().trim().min(1).max(40).optional(),
    truckType: z.string().trim().min(1).max(60).optional(),
    capacity: z.string().trim().max(60).optional(),
    status: z.nativeEnum(TruckStatus).optional(),
    lastServiceDate: z.coerce.date().optional(),
    nextServiceDue: z.coerce.date().optional(),
    maintenanceNotes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field' });

// --- Service areas ----------------------------------------------------------

export const createServiceAreaSchema = z.object({
  name: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  surcharge: z.number().int().nonnegative().default(0),
  waitlist: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateServiceAreaSchema = createServiceAreaSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field' },
);

// --- Reports ----------------------------------------------------------------

export const reportRangeQuery = z.object({
  from: dateOnly,
  to: dateOnly,
});

export const exportQuery = z.object({
  from: dateOnly,
  to: dateOnly,
  format: z.enum(['json', 'csv']).default('csv'),
});
