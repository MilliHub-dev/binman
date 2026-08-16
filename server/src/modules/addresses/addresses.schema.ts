import { z } from 'zod';
import { phoneField } from '../auth/auth.schema';

export const createAddressSchema = z.object({
  label: z.string().trim().min(1, 'Give this address a name, e.g. Home').max(40),
  addressLine: z.string().trim().min(3, 'Street address is required').max(200),
  area: z.string().trim().min(1, 'Area is required').max(80),
  city: z.string().trim().min(1, 'City is required').max(80),
  state: z.string().trim().min(1, 'State is required').max(80),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  instructions: z.string().trim().max(500).optional(),
  contactName: z.string().trim().max(80).optional(),
  contactPhone: phoneField.optional(),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update' },
);

export const addressIdParam = z.object({ id: z.string().min(1) });

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
