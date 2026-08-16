import { z } from 'zod';
import {
  CleaningType,
  CollectionSize,
  PropertySize,
  ServiceType,
  WasteType,
} from '@prisma/client';

export const quoteSchema = z
  .object({
    serviceType: z.nativeEnum(ServiceType),
    wasteTypes: z.array(z.nativeEnum(WasteType)).min(1).max(9).optional(),
    collectionSize: z.nativeEnum(CollectionSize).optional(),
    cleaningType: z.nativeEnum(CleaningType).optional(),
    propertySize: z.nativeEnum(PropertySize).optional(),
    /** Quote for a saved address; the area is derived from it. */
    addressId: z.string().min(1).optional(),
    area: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === ServiceType.WASTE_COLLECTION) {
      if (!data.collectionSize) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['collectionSize'],
          message: 'Collection size is required for a waste pickup',
        });
      }
      if (!data.wasteTypes || data.wasteTypes.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['wasteTypes'],
          message: 'Select at least one waste type',
        });
      }
    } else {
      if (!data.cleaningType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cleaningType'],
          message: 'Cleaning type is required',
        });
      }
      if (!data.propertySize) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['propertySize'],
          message: 'Property size is required',
        });
      }
    }
  });

export const priceListQuery = z.object({
  serviceAreaId: z.string().min(1).optional(),
});

export const createPricingRuleSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
  wasteType: z.nativeEnum(WasteType).nullable().optional(),
  collectionSize: z.nativeEnum(CollectionSize).nullable().optional(),
  cleaningType: z.nativeEnum(CleaningType).nullable().optional(),
  propertySize: z.nativeEnum(PropertySize).nullable().optional(),
  serviceAreaId: z.string().min(1).nullable().optional(),
  /** Kobo. ₦2,500 => 250000. */
  basePrice: z.number().int().nonnegative(),
  serviceFee: z.number().int().nonnegative().default(0),
  currency: z.string().length(3).default('NGN'),
  isActive: z.boolean().default(true),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
});

export const updatePricingRuleSchema = createPricingRuleSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update' },
);

export type QuoteInput = z.infer<typeof quoteSchema>;
