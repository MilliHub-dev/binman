import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    email: z.string().trim().email('Enter a valid email address').max(180).nullable().optional(),
    profileImage: z.string().url().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const notificationPreferencesSchema = z
  .object({
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
    email: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one preference' });

export const pushTokenSchema = z.object({
  /** FCM registration token; null clears it on sign-out from a device. */
  pushToken: z.string().min(10).max(500).nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
