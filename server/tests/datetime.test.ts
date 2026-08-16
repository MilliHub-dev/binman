import { describe, expect, it } from 'vitest';
import {
  dayOfWeek,
  formatDateOnly,
  minutesToDisplay,
  nextMatchingDate,
  slotWindowLabel,
  toDateOnly,
} from '../src/lib/datetime';

describe('slot time formatting', () => {
  it('renders minutes-from-midnight as a 12-hour clock', () => {
    expect(minutesToDisplay(420)).toBe('7:00 AM');
    expect(minutesToDisplay(720)).toBe('12:00 PM');
    expect(minutesToDisplay(780)).toBe('1:00 PM');
    expect(minutesToDisplay(0)).toBe('12:00 AM');
    expect(minutesToDisplay(1_410)).toBe('11:30 PM');
  });

  it('renders the window shown on the booking screen', () => {
    expect(slotWindowLabel(420, 540)).toBe('7:00 AM – 9:00 AM');
  });
});

describe('date-only handling', () => {
  it('round-trips a date string without timezone drift', () => {
    expect(formatDateOnly(toDateOnly('2026-08-15'))).toBe('2026-08-15');
    expect(formatDateOnly(toDateOnly('2026-01-01'))).toBe('2026-01-01');
    expect(formatDateOnly(toDateOnly('2026-12-31'))).toBe('2026-12-31');
  });

  it('numbers weekdays from Sunday, matching Subscription.daysOfWeek', () => {
    // 2026-08-15 is a Saturday.
    expect(dayOfWeek('2026-08-15')).toBe(6);
    expect(dayOfWeek('2026-08-16')).toBe(0);
  });
});

describe('nextMatchingDate', () => {
  it('returns the same day when it already matches', () => {
    expect(formatDateOnly(nextMatchingDate('2026-08-15', [6])!)).toBe('2026-08-15');
  });

  it('walks forward to the next listed weekday', () => {
    // From Saturday, the next Monday is the 17th.
    expect(formatDateOnly(nextMatchingDate('2026-08-15', [1])!)).toBe('2026-08-17');
  });

  it('picks the soonest of several days', () => {
    // From Saturday: Sunday (0) beats Wednesday (3).
    expect(formatDateOnly(nextMatchingDate('2026-08-15', [0, 3])!)).toBe('2026-08-16');
  });

  it('returns null when no day is selected', () => {
    expect(nextMatchingDate('2026-08-15', [])).toBeNull();
  });
});
