import { randomBytes, randomInt } from 'node:crypto';
import { ServiceType } from '@prisma/client';

/**
 * Human-facing identifiers. These end up read aloud over the phone and typed
 * into WhatsApp, so they avoid ambiguous characters (0/O, 1/I/L).
 */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const randomToken = (length: number): string => {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
};

const SERVICE_PREFIX: Record<ServiceType, string> = {
  WASTE_COLLECTION: 'WST',
  CLEANING: 'CLN',
};

/** e.g. WST7K2M4Q — collision-checked by the unique index on the column. */
export const generateBookingReference = (serviceType: ServiceType): string =>
  `${SERVICE_PREFIX[serviceType]}${randomToken(6)}`;

/** Our idempotent tx_ref sent to Flutterwave. Must be globally unique. */
export const generatePaymentReference = (): string =>
  `BM-${Date.now().toString(36).toUpperCase()}-${randomToken(6)}`;

export const generateTicketNumber = (): string => `TKT${randomToken(6)}`;

/** Numeric OTP, uniformly distributed, from a CSPRNG. */
export const generateOtp = (length: number): string => {
  let out = '';
  for (let i = 0; i < length; i += 1) out += randomInt(0, 10).toString();
  return out;
};
