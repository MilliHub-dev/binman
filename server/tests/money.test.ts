import { describe, expect, it } from 'vitest';
import { amountsMatch, formatMoney, toMajorUnits, toMinorUnits } from '../src/lib/money';

/**
 * Money is stored in kobo and Flutterwave speaks naira. A rounding slip at that
 * boundary either short-changes the customer or credits an unpaid booking.
 */
describe('money conversion', () => {
  it('converts between kobo and naira', () => {
    expect(toMajorUnits(250_000)).toBe(2500);
    expect(toMinorUnits(2500)).toBe(250_000);
    expect(toMinorUnits(2500.5)).toBe(250_050);
  });

  it('survives a float round trip that would otherwise drift', () => {
    // 0.1 + 0.2 style drift: 1999.99 naira must come back as exactly 199999 kobo.
    expect(toMinorUnits(toMajorUnits(199_999))).toBe(199_999);
  });

  it('formats as Naira', () => {
    const formatted = formatMoney(250_000);
    expect(formatted).toContain('2,500');
  });
});

describe('amountsMatch', () => {
  it('accepts the exact amount the provider reports', () => {
    expect(amountsMatch(250_000, 2500)).toBe(true);
    expect(amountsMatch(250_050, 2500.5)).toBe(true);
  });

  it('rejects an underpayment, however small', () => {
    expect(amountsMatch(250_000, 2499.99)).toBe(false);
    expect(amountsMatch(250_000, 25)).toBe(false);
  });

  it('rejects an overpayment so it is reviewed rather than silently accepted', () => {
    expect(amountsMatch(250_000, 2500.01)).toBe(false);
  });
});
