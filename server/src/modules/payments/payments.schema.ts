import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
});

export const referenceParam = z.object({
  reference: z.string().min(4).max(80),
});
