import { BadRequestError } from './errors';

/**
 * Phone numbers are the primary identity across the app, WhatsApp and SMS, so
 * they must normalise to exactly one canonical form. Everything is stored as
 * E.164 (+2348012345678).
 *
 * Nigerian numbers arrive in all of these shapes:
 *   08012345678, 8012345678, 2348012345678, +2348012345678, 0803 123 4567
 */

const NG_COUNTRY_CODE = '234';
/** Nigerian mobile network codes are 3 digits following the country code. */
const NG_NSN_LENGTH = 10;

export const normalisePhone = (input: string, defaultCountry = NG_COUNTRY_CODE): string => {
  const raw = String(input ?? '').trim();
  if (!raw) throw new BadRequestError('Phone number is required', 'PHONE_REQUIRED');

  // Keep a leading + so we can tell "already international" from "local".
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');

  if (!digits) throw new BadRequestError('Phone number is invalid', 'PHONE_INVALID');

  let e164: string;

  if (hasPlus) {
    e164 = `+${digits}`;
  } else if (digits.startsWith(defaultCountry) && digits.length === defaultCountry.length + NG_NSN_LENGTH) {
    // 2348012345678
    e164 = `+${digits}`;
  } else if (digits.startsWith('0') && digits.length === NG_NSN_LENGTH + 1) {
    // 08012345678 -> drop the trunk prefix
    e164 = `+${defaultCountry}${digits.slice(1)}`;
  } else if (digits.length === NG_NSN_LENGTH) {
    // 8012345678
    e164 = `+${defaultCountry}${digits}`;
  } else {
    throw new BadRequestError('Phone number is invalid', 'PHONE_INVALID');
  }

  // E.164 allows at most 15 digits; anything under 8 is not a real number.
  const finalDigits = e164.slice(1);
  if (finalDigits.length < 8 || finalDigits.length > 15) {
    throw new BadRequestError('Phone number is invalid', 'PHONE_INVALID');
  }

  return e164;
};

/** Best-effort normalisation — returns null instead of throwing. */
export const tryNormalisePhone = (input: string): string | null => {
  try {
    return normalisePhone(input);
  } catch {
    return null;
  }
};

/** +2348012345678 -> +234 801 *** 5678, for logs and support screens. */
export const maskPhone = (phone: string): string => {
  if (phone.length < 8) return '***';
  return `${phone.slice(0, -6)}***${phone.slice(-3)}`;
};
