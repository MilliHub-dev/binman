import { z } from 'zod';
import { BookingStatus, DriverAvailability, FailureReason } from '@prisma/client';

/** The subset of statuses a driver may set from the field (driver.md §4). */
export const DRIVER_SETTABLE_STATUSES = [
  BookingStatus.DRIVER_EN_ROUTE,
  BookingStatus.ARRIVED,
  BookingStatus.COLLECTED,
  BookingStatus.COMPLETED,
] as const;

export const jobsQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  scope: z.enum(['today', 'upcoming', 'completed', 'all']).default('today'),
});

export const updateJobStatusSchema = z.object({
  status: z.enum(DRIVER_SETTABLE_STATUSES),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const failJobSchema = z.object({
  reason: z.nativeEnum(FailureReason),
  description: z.string().trim().max(1000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Proof is submitted as multipart, so numeric fields arrive as strings.
 * Coercion happens here rather than in the controller.
 */
export const submitProofSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(1000).optional(),
  customerConfirmed: z.coerce.boolean().default(false),
});

export const locationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Present while on an active job, so the customer's map can follow it. */
  bookingId: z.string().min(1).optional(),
});

export const availabilitySchema = z.object({
  availabilityStatus: z.enum([
    DriverAvailability.AVAILABLE,
    DriverAvailability.BUSY,
    DriverAvailability.OFFLINE,
  ]),
});

export const jobIdParam = z.object({ id: z.string().min(1) });
