/**
 * All money in this codebase is an integer number of MINOR units (kobo).
 * ₦2,500.00 is 250000. Nothing is ever a float.
 *
 * Flutterwave's API, by contrast, speaks MAJOR units (naira), so the boundary
 * conversion lives here and nowhere else.
 */

export const MINOR_UNITS_PER_MAJOR = 100;

export const toMajorUnits = (minor: number): number => minor / MINOR_UNITS_PER_MAJOR;

export const toMinorUnits = (major: number): number => Math.round(major * MINOR_UNITS_PER_MAJOR);

/** ₦2,500.00 */
export const formatMoney = (minor: number, currency = 'NGN'): string => {
  const formatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(toMajorUnits(minor));
};

/**
 * A payment matches its booking if the amounts agree to the kobo. Flutterwave
 * can return a float in major units, so compare after rounding rather than
 * trusting `===` on the converted value.
 */
export const amountsMatch = (expectedMinor: number, providerMajor: number): boolean =>
  toMinorUnits(providerMajor) === expectedMinor;
