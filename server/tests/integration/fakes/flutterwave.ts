import type { VerifiedTransaction } from '../../../src/services/flutterwave.service';

/**
 * Stand-in for the Flutterwave client.
 *
 * Tests must never reach the real payment provider — the account configured in
 * .env holds LIVE keys. This fake lets a test drive the exact provider
 * responses that matter: success, wrong amount, failure.
 */

export const charges: Array<{ reference: string; amount: number }> = [];

/** What the next verification should report. Tests set this. */
export const state: {
  status: VerifiedTransaction['status'];
  /** Major units, as the real API returns. Null = echo the charged amount. */
  amountOverride: number | null;
  currency: string;
} = {
  status: 'successful',
  amountOverride: null,
  currency: 'NGN',
};

export const initiateCharge = async (input: {
  reference: string;
  amount: number;
  currency: string;
}): Promise<{ checkoutUrl: string; raw: unknown }> => {
  charges.push({ reference: input.reference, amount: input.amount });
  return {
    checkoutUrl: `https://checkout.test/pay/${input.reference}`,
    raw: { status: 'success', data: { link: `https://checkout.test/pay/${input.reference}` } },
  };
};

const build = (reference: string): VerifiedTransaction => {
  const charge = charges.find((c) => c.reference === reference);
  // Convert our kobo back to the major units the provider speaks.
  const amount = state.amountOverride ?? (charge ? charge.amount / 100 : 0);
  return {
    transactionId: `fw_${reference}`,
    reference,
    status: state.status,
    amount,
    currency: state.currency,
    channel: 'card',
    customerEmail: 'test@binman.ng',
    raw: { status: 'success', data: { id: `fw_${reference}` } },
  };
};

/**
 * Transaction ids look like `fw_<reference>`, optionally with a `#suffix` so a
 * test can model two distinct provider transactions against one booking (a
 * failed attempt followed by a successful one).
 */
export const verifyTransaction = async (transactionId: string): Promise<VerifiedTransaction> =>
  build(transactionId.replace(/^fw_/, '').replace(/#.*$/, ''));

export const verifyByReference = async (reference: string): Promise<VerifiedTransaction | null> =>
  charges.some((c) => c.reference === reference) ? build(reference) : null;

export const isValidWebhookSignature = (signature: string | undefined): boolean =>
  signature === 'test-hash';

export const computeBodySignature = (): string => 'test-signature';

export const __resetFlutterwave = (): void => {
  charges.length = 0;
  state.status = 'successful';
  state.amountOverride = null;
  state.currency = 'NGN';
};
