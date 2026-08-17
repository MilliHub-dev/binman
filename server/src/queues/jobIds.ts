/**
 * Job identifiers for BullMQ.
 *
 * BullMQ composes its Redis keys with ':' and rejects any custom id containing
 * one — "Custom Id cannot contain :". That threw inside `paymentQueue.add`, so
 * every attempt to pay 500'd immediately after the booking had been created,
 * leaving the customer with an unpayable booking.
 *
 * The ids live here, away from the queue modules, so they can be tested without
 * a Redis connection. The integration suite swaps the queues for a fake, which
 * is precisely why nothing caught this: the fake accepted an id the real
 * library would not.
 */

/**
 * Deliberately stricter than BullMQ itself.
 *
 * BullMQ rejects a ':' *unless* the id splits into exactly three segments — a
 * carve-out kept for compatibility with old repeatable jobs, which is a quirk
 * rather than a contract. `verify:REF` was rejected and `verify:REF:2` slipped
 * through on that technicality, which is precisely the kind of difference
 * nobody should have to remember. No colons at all.
 */
export const isValidJobId = (id: string): boolean =>
  id.length > 0 && !id.includes(':') && `${parseInt(id, 10)}` !== id;

/**
 * Reconciliation job for a payment, in case the webhook never arrives.
 * Stable per reference and attempt, so a retry cannot enqueue a duplicate.
 */
export const paymentVerifyJobId = (reference: string, attempt = 1): string =>
  `verify-${reference}-${attempt}`;

/**
 * The "how did we do?" nudge after a completed job. One per booking, so a
 * retried completion cannot ask the same customer twice.
 */
export const reviewRequestJobId = (bookingId: string): string => `review-${bookingId}`;

/** The nightly subscription sweep. */
export const SUBSCRIPTION_SWEEP_JOB_ID = 'subscription-sweep';
