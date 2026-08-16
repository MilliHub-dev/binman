import { z } from 'zod';

const MINUTES_IN_DAY = 24 * 60;

const minuteOfDay = z
  .number()
  .int()
  .min(0)
  .max(MINUTES_IN_DAY, 'Time must be within a single day')
  .describe('Minutes from midnight, e.g. 07:00 => 420');

export const availabilityQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  /** >1 returns a day-by-day range, for the date strip on the booking screen. */
  days: z.coerce.number().int().min(1).max(30).default(1),
});

export const createTimeSlotSchema = z.object({
  label: z.string().trim().min(1).max(60),
  startTime: minuteOfDay,
  endTime: minuteOfDay,
  maxBookings: z.number().int().positive().max(1000).default(20),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateTimeSlotSchema = createTimeSlotSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update' },
);

export const slotIdParam = z.object({ id: z.string().min(1) });
