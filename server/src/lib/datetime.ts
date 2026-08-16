import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/**
 * The business runs in one timezone. Slots are stored as minutes-from-midnight
 * and must be interpreted in local (Lagos) time, not the server's.
 */
export const BUSINESS_TIMEZONE = 'Africa/Lagos';

export { dayjs };

/** 'YYYY-MM-DD' -> a UTC-midnight Date suitable for a Postgres `date` column. */
export const toDateOnly = (input: string | Date): Date => {
  const d = dayjs.utc(typeof input === 'string' ? input : dayjs(input).format('YYYY-MM-DD'), 'YYYY-MM-DD');
  return d.startOf('day').toDate();
};

export const formatDateOnly = (input: Date): string => dayjs.utc(input).format('YYYY-MM-DD');

/** Today's date in business time — not the server's UTC date. */
export const businessToday = (): string => dayjs().tz(BUSINESS_TIMEZONE).format('YYYY-MM-DD');

/** 420 -> '07:00' */
export const minutesToLabel = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** 420 -> '7:00 AM' */
export const minutesToDisplay = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const slotWindowLabel = (start: number, end: number): string =>
  `${minutesToDisplay(start)} – ${minutesToDisplay(end)}`;

/**
 * The absolute instant a slot opens on a given date, in business time. Used for
 * cancellation windows and reminder scheduling.
 */
export const slotStartInstant = (date: Date | string, startMinutes: number): Date => {
  const dateStr = typeof date === 'string' ? date : formatDateOnly(date);
  return dayjs
    .tz(dateStr, 'YYYY-MM-DD', BUSINESS_TIMEZONE)
    .add(startMinutes, 'minute')
    .toDate();
};

/** Has the slot on this date already started? */
export const isSlotInPast = (date: Date | string, startMinutes: number): boolean =>
  slotStartInstant(date, startMinutes).getTime() <= Date.now();

/** Hours remaining until the slot opens; negative once it has passed. */
export const hoursUntilSlot = (date: Date | string, startMinutes: number): number =>
  (slotStartInstant(date, startMinutes).getTime() - Date.now()) / 3_600_000;

/** 0 = Sunday … 6 = Saturday, matching Subscription.daysOfWeek. */
export const dayOfWeek = (date: Date | string): number =>
  dayjs.utc(typeof date === 'string' ? date : formatDateOnly(date), 'YYYY-MM-DD').day();

/**
 * Next date on or after `from` whose weekday is in `days`.
 * Returns null when `days` is empty.
 */
export const nextMatchingDate = (from: Date | string, days: number[]): Date | null => {
  if (days.length === 0) return null;
  const start = dayjs.utc(typeof from === 'string' ? from : formatDateOnly(from), 'YYYY-MM-DD');
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = start.add(offset, 'day');
    if (days.includes(candidate.day())) return candidate.startOf('day').toDate();
  }
  return null;
};
