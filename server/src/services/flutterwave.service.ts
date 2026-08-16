import { createHmac, timingSafeEqual } from 'node:crypto';
import axios, { type AxiosInstance } from 'axios';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';
import { ServiceUnavailableError } from '../lib/errors';
import { toMajorUnits } from '../lib/money';

const log = createLogger('flutterwave');

/**
 * Flutterwave v3 client.
 *
 * Two rules drive everything here:
 *  1. The API speaks MAJOR units (naira). We speak kobo. Conversion happens
 *     only at this boundary.
 *  2. Nothing a client or a webhook body claims about payment status is
 *     trusted — status is only ever read back from `verifyTransaction`
 *     (trsa.md §9).
 */

export interface InitiateChargeInput {
  reference: string;
  /** Kobo. */
  amount: number;
  currency: string;
  customer: { email: string; phone: string; name: string };
  /** Shown on the Flutterwave checkout page. */
  title: string;
  description: string;
  meta?: Record<string, string>;
}

export interface InitiateChargeResult {
  checkoutUrl: string;
  raw: unknown;
}

export interface VerifiedTransaction {
  /** Flutterwave's numeric transaction id. */
  transactionId: string;
  /** Our tx_ref, echoed back. */
  reference: string;
  status: 'successful' | 'failed' | 'pending';
  /** Major units, exactly as the provider reported it. */
  amount: number;
  currency: string;
  channel: string | null;
  customerEmail: string | null;
  raw: unknown;
}

let cached: AxiosInstance | null = null;

const client = (): AxiosInstance => {
  if (cached) return cached;
  cached = axios.create({
    baseURL: env.FLUTTERWAVE_BASE_URL,
    timeout: 20_000,
    headers: {
      Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  return cached;
};

const describeError = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
};

/**
 * Creates a hosted-checkout session and returns the URL to send the customer to.
 * We never handle card details ourselves.
 */
export const initiateCharge = async (input: InitiateChargeInput): Promise<InitiateChargeResult> => {
  try {
    const { data } = await client().post('/payments', {
      tx_ref: input.reference,
      amount: toMajorUnits(input.amount),
      currency: input.currency,
      redirect_url: env.FLUTTERWAVE_REDIRECT_URL,
      customer: {
        email: input.customer.email,
        phonenumber: input.customer.phone,
        name: input.customer.name,
      },
      customizations: {
        title: input.title,
        description: input.description,
      },
      meta: input.meta ?? {},
    });

    const checkoutUrl = data?.data?.link;
    if (data?.status !== 'success' || !checkoutUrl) {
      log.error({ response: data }, 'flutterwave did not return a checkout link');
      throw new ServiceUnavailableError(
        'We could not start your payment. Please try again.',
        'PAYMENT_INITIATION_FAILED',
      );
    }

    return { checkoutUrl, raw: data };
  } catch (err) {
    if (err instanceof ServiceUnavailableError) throw err;
    const detail = describeError(err);
    log.error({ detail, reference: input.reference }, 'flutterwave charge initiation failed');
    throw new ServiceUnavailableError(
      'We could not start your payment. Please try again.',
      'PAYMENT_INITIATION_FAILED',
      { detail },
    );
  }
};

const normaliseStatus = (status: unknown): VerifiedTransaction['status'] => {
  const value = String(status ?? '').toLowerCase();
  if (value === 'successful') return 'successful';
  if (value === 'failed' || value === 'cancelled') return 'failed';
  return 'pending';
};

const mapTransaction = (payload: Record<string, unknown>, raw: unknown): VerifiedTransaction => ({
  transactionId: String(payload.id ?? ''),
  reference: String(payload.tx_ref ?? ''),
  status: normaliseStatus(payload.status),
  amount: Number(payload.amount ?? 0),
  currency: String(payload.currency ?? env.CURRENCY),
  channel: (payload.payment_type as string | undefined) ?? null,
  customerEmail: ((payload.customer as { email?: string } | undefined)?.email) ?? null,
  raw,
});

/** Authoritative status lookup by Flutterwave's transaction id. */
export const verifyTransaction = async (transactionId: string): Promise<VerifiedTransaction> => {
  try {
    const { data } = await client().get(`/transactions/${transactionId}/verify`);
    if (data?.status !== 'success' || !data?.data) {
      throw new ServiceUnavailableError('Could not verify the transaction', 'PAYMENT_VERIFICATION_FAILED');
    }
    return mapTransaction(data.data, data);
  } catch (err) {
    if (err instanceof ServiceUnavailableError) throw err;
    const detail = describeError(err);
    log.error({ detail, transactionId }, 'flutterwave verification failed');
    throw new ServiceUnavailableError('Could not verify the transaction', 'PAYMENT_VERIFICATION_FAILED', {
      detail,
    });
  }
};

/**
 * Status lookup by OUR reference. Used when the customer returns from checkout
 * and by the reconciliation worker, where no transaction id is at hand.
 */
export const verifyByReference = async (reference: string): Promise<VerifiedTransaction | null> => {
  try {
    const { data } = await client().get('/transactions/verify_by_reference', {
      params: { tx_ref: reference },
    });
    if (data?.status !== 'success' || !data?.data) return null;
    return mapTransaction(data.data, data);
  } catch (err) {
    // A 404 simply means the customer never got as far as paying.
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    log.error({ detail: describeError(err), reference }, 'flutterwave reference lookup failed');
    return null;
  }
};

/**
 * Webhook authentication (trsa.md §10).
 *
 * Flutterwave sends the dashboard-configured "secret hash" verbatim in the
 * `verif-hash` header. Compared in constant time so the check cannot be
 * probed byte by byte.
 */
export const isValidWebhookSignature = (signature: string | undefined): boolean => {
  const expected = env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  if (!expected || !signature) return false;

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

/** Available for provider configurations that sign the body instead. */
export const computeBodySignature = (rawBody: Buffer): string =>
  createHmac('sha256', env.FLUTTERWAVE_WEBHOOK_SECRET_HASH).update(rawBody).digest('hex');
