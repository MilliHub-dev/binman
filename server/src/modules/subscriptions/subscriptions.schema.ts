import { z } from 'zod';
import { CollectionSize, ServiceType, SubscriptionFrequency, SubscriptionStatus, WasteType } from '@prisma/client';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const createSubscriptionSchema = z
  .object({
    serviceType: z.nativeEnum(ServiceType).default(ServiceType.WASTE_COLLECTION),
    frequency: z.nativeEnum(SubscriptionFrequency),
    /** 0 = Sunday … 6 = Saturday. */
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    timeSlotId: z.string().min(1),
    addressId: z.string().min(1),
    wasteTypes: z.array(z.nativeEnum(WasteType)).min(1).optional(),
    collectionSize: z.nativeEnum(CollectionSize).optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === ServiceType.WASTE_COLLECTION && !data.collectionSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['collectionSize'],
        message: 'Collection size is required',
      });
    }
    if (data.frequency === SubscriptionFrequency.TWICE_WEEKLY && data.daysOfWeek.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['daysOfWeek'],
        message: 'Twice-weekly subscriptions need exactly two days',
      });
    }
    if (data.endDate && data.startDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date must be after the start date',
      });
    }
  });

export const updateSubscriptionSchema = z
  .object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    timeSlotId: z.string().min(1).optional(),
    addressId: z.string().min(1).optional(),
    /** Pause/resume from the subscriptions screen (ui.md §35). */
    status: z.enum([SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const subscriptionIdParam = z.object({ id: z.string().min(1) });

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
