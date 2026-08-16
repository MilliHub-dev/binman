import { z } from 'zod';
import {
  BookingStatus,
  CleaningType,
  CollectionSize,
  PropertySize,
  PropertyType,
  ServiceType,
  WasteType,
} from '@prisma/client';
import { paginationQuery } from '../../lib/pagination';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const createBookingSchema = z
  .object({
    serviceType: z.nativeEnum(ServiceType),
    addressId: z.string().min(1, 'Select a pickup address'),
    scheduledDate: dateOnly,
    timeSlotId: z.string().min(1, 'Select a time slot'),
    notes: z.string().trim().max(1000).optional(),

    // Waste collection
    wasteTypes: z.array(z.nativeEnum(WasteType)).min(1).max(9).optional(),
    collectionSize: z.nativeEnum(CollectionSize).optional(),
    estimatedQuantity: z.string().trim().max(120).optional(),

    // Cleaning
    cleaningType: z.nativeEnum(CleaningType).optional(),
    propertyType: z.nativeEnum(PropertyType).optional(),
    propertySize: z.nativeEnum(PropertySize).optional(),
    numberOfRooms: z.number().int().min(1).max(50).optional(),

    specialInstructions: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === ServiceType.WASTE_COLLECTION) {
      if (!data.wasteTypes?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['wasteTypes'],
          message: 'Select at least one waste type',
        });
      }
      if (!data.collectionSize) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['collectionSize'],
          message: 'Select how much waste you have',
        });
      }
    } else {
      for (const field of ['cleaningType', 'propertyType', 'propertySize'] as const) {
        if (!data[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for a cleaning booking`,
          });
        }
      }
    }
  });

export const listBookingsQuery = z.object({
  ...paginationQuery,
  /** UI tabs: Upcoming | Active | Completed (ui.md §26). */
  scope: z.enum(['all', 'upcoming', 'active', 'completed']).default('all'),
  status: z.nativeEnum(BookingStatus).optional(),
  serviceType: z.nativeEnum(ServiceType).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleBookingSchema = z.object({
  scheduledDate: dateOnly,
  timeSlotId: z.string().min(1),
});

export const bookingIdParam = z.object({ id: z.string().min(1) });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuery>;
