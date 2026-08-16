import { z } from 'zod';
import { normalisePhone } from '../../lib/phone';

/**
 * Phone numbers are normalised to E.164 during validation, so every layer
 * below the controller sees exactly one representation.
 */
export const phoneField = z
  .string()
  .min(7, 'Phone number is too short')
  .max(20, 'Phone number is too long')
  .transform((value, ctx) => {
    try {
      return normalisePhone(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid Nigerian phone number' });
      return z.NEVER;
    }
  });

export const requestOtpSchema = z.object({
  phone: phoneField,
});

export const verifyOtpSchema = z.object({
  phone: phoneField,
  otp: z
    .string()
    .regex(/^\d{4,8}$/, 'Verification code must be 4–8 digits'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).optional(),
  /** Sign out of every device rather than just this one. */
  allDevices: z.boolean().default(false),
});

export const completeProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email: z.string().trim().email('Enter a valid email address').max(180).optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

/** Staff sign-in. Email is lower-cased so casing never causes a mismatch. */
export const passwordLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(180),
  password: z.string().min(1, 'Enter your password').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: z.string().min(10, 'Password must be at least 10 characters').max(200),
});

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
