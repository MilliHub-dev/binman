import {
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  WebhookStatus,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { generatePaymentReference } from '../../lib/reference';
import { amountsMatch, formatMoney } from '../../lib/money';
import { env } from '../../config/env';
import * as flutterwave from '../../services/flutterwave.service';
import * as notifications from '../../services/notification.service';
import { transitionBooking } from '../bookings/bookings.service';
import { paymentQueue } from '../../queues/queues';
import { paymentVerifyJobId } from '../../queues/jobIds';

const log = createLogger('payments');

/**
 * Payment flow (trsa.md §9):
 *
 *   initiate -> customer pays on Flutterwave -> webhook or return-poll
 *   -> we verify against the provider API -> booking becomes PAID
 *
 * The mobile app can never mark a booking paid. Only `confirmFromProvider`
 * does, and only after reading status back from Flutterwave.
 */

export interface InitiateResult {
  reference: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  formattedAmount: string;
}

export const initiatePayment = async (
  bookingId: string,
  userId: string,
): Promise<InitiateResult> => {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { user: true },
  });
  if (!booking) throw new NotFoundError('Booking');

  if (booking.paymentStatus === PaymentStatus.SUCCESSFUL) {
    throw new ConflictError('This booking has already been paid for', 'ALREADY_PAID');
  }
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    throw new ConflictError('This booking is not awaiting payment', 'NOT_AWAITING_PAYMENT');
  }

  // Reuse a live checkout session rather than orphaning payment attempts.
  const existing = await prisma.payment.findFirst({
    where: { bookingId, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
    orderBy: { createdAt: 'desc' },
  });

  if (existing?.checkoutUrl) {
    return {
      reference: existing.reference,
      checkoutUrl: existing.checkoutUrl,
      amount: existing.amount,
      currency: existing.currency,
      formattedAmount: formatMoney(existing.amount, existing.currency),
    };
  }

  const reference = generatePaymentReference();

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      userId,
      reference,
      provider: PaymentProvider.FLUTTERWAVE,
      amount: booking.totalAmount,
      currency: booking.currency,
      status: PaymentStatus.PENDING,
    },
  });

  const customerName =
    [booking.user.firstName, booking.user.lastName].filter(Boolean).join(' ') || 'BinMan Customer';

  const charge = await flutterwave.initiateCharge({
    reference,
    amount: booking.totalAmount,
    currency: booking.currency,
    customer: {
      // Flutterwave requires an email; synthesise a routable-looking one when
      // the customer signed up with a phone number only.
      email: booking.user.email ?? `${booking.user.phone.replace('+', '')}@customers.binman.ng`,
      phone: booking.user.phone,
      name: customerName,
    },
    title: 'BinMan',
    description: `Payment for booking ${booking.reference}`,
    meta: { bookingId: booking.id, bookingReference: booking.reference, userId },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.PROCESSING,
      checkoutUrl: charge.checkoutUrl,
      providerResponse: charge.raw as Prisma.InputJsonValue,
    },
  });

  /**
   * Safety net: if the webhook never arrives, reconcile by polling.
   *
   * The id is hyphenated, not colon-separated. BullMQ uses ':' to build its own
   * Redis keys and rejects a custom id containing one — which threw here and
   * turned every payment into a 500 immediately after the booking was created.
   */
  await paymentQueue.add(
    'verify',
    { paymentReference: reference },
    { delay: 2 * 60_000, jobId: paymentVerifyJobId(reference) },
  );

  log.info({ bookingId, reference, amount: booking.totalAmount }, 'payment initiated');

  return {
    reference,
    checkoutUrl: charge.checkoutUrl,
    amount: booking.totalAmount,
    currency: booking.currency,
    formattedAmount: formatMoney(booking.totalAmount, booking.currency),
  };
};

/**
 * The single place a payment is ever marked successful.
 *
 * Idempotent: a webhook, the customer's return-from-checkout poll and the
 * reconciliation worker all call this, frequently for the same transaction.
 */
export const confirmFromProvider = async (
  verified: flutterwave.VerifiedTransaction,
): Promise<{ applied: boolean; reason?: string }> => {
  const payment = await prisma.payment.findUnique({
    where: { reference: verified.reference },
    include: { booking: true },
  });

  if (!payment) {
    log.warn({ reference: verified.reference }, 'verified transaction has no matching payment');
    return { applied: false, reason: 'PAYMENT_NOT_FOUND' };
  }

  if (payment.status === PaymentStatus.SUCCESSFUL) {
    return { applied: false, reason: 'ALREADY_APPLIED' };
  }

  if (verified.status === 'pending') {
    return { applied: false, reason: 'STILL_PENDING' };
  }

  if (verified.status === 'failed') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        providerTransactionId: verified.transactionId,
        failureReason: 'Provider reported the transaction as failed',
        providerResponse: verified.raw as Prisma.InputJsonValue,
      },
    });
    log.info({ reference: verified.reference }, 'payment failed at provider');
    return { applied: true, reason: 'FAILED' };
  }

  // Successful — but only if it is actually the right money.
  if (!amountsMatch(payment.amount, verified.amount)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        providerTransactionId: verified.transactionId,
        failureReason: `Amount mismatch: expected ${payment.amount} kobo, provider reported ${verified.amount} ${verified.currency}`,
        providerResponse: verified.raw as Prisma.InputJsonValue,
      },
    });
    log.error(
      { reference: verified.reference, expected: payment.amount, received: verified.amount },
      'payment amount mismatch — NOT crediting booking',
    );
    return { applied: false, reason: 'AMOUNT_MISMATCH' };
  }

  if (verified.currency !== payment.currency) {
    log.error(
      { reference: verified.reference, expected: payment.currency, received: verified.currency },
      'payment currency mismatch — NOT crediting booking',
    );
    return { applied: false, reason: 'CURRENCY_MISMATCH' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCESSFUL,
        providerTransactionId: verified.transactionId,
        channel: verified.channel,
        paidAt: new Date(),
        providerResponse: verified.raw as Prisma.InputJsonValue,
      },
    });

    if (payment.bookingId) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: PaymentStatus.SUCCESSFUL },
      });
    }
  });

  // Advance the booking outside the payment transaction so a lifecycle problem
  // cannot roll back a payment we have genuinely received.
  if (payment.bookingId && payment.booking?.status === BookingStatus.PENDING_PAYMENT) {
    await transitionBooking(payment.bookingId, BookingStatus.PAID, {
      reason: `Payment ${verified.reference} confirmed`,
    });
    // Straight into the dispatcher's queue (prd.md §15).
    await transitionBooking(payment.bookingId, BookingStatus.PENDING_ASSIGNMENT, {
      reason: 'Awaiting dispatch',
    });

    const booking = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
      include: { timeSlot: true },
    });

    if (booking) {
      void notifications.notifyPaymentReceived(
        booking,
        formatMoney(payment.amount, payment.currency),
      );
      void notifications.notifyBookingConfirmed(booking);
    }
  }

  log.info({ reference: verified.reference, bookingId: payment.bookingId }, 'payment confirmed');

  return { applied: true, reason: 'CONFIRMED' };
};

/**
 * Processes an inbound Flutterwave webhook.
 *
 * Idempotency comes from the unique (provider, eventKey) index. The key is
 * scoped by event type as well as transaction id, because one transaction
 * legitimately produces several distinct events (a charge, later a refund) and
 * collapsing them would drop the second.
 *
 * A duplicate is only ignored if the earlier attempt REACHED A CONCLUSION.
 * An attempt that failed part-way — provider unreachable during verification,
 * say — must be allowed to run again, or Flutterwave's retry would be rejected
 * as a duplicate and the payment would never be confirmed.
 */
export const handleWebhook = async (
  payload: Record<string, unknown>,
): Promise<{ handled: boolean; reason: string }> => {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const eventType = String(payload.event ?? payload['event.type'] ?? 'unknown');

  // Prefer the provider's transaction id; fall back to our tx_ref.
  const transactionKey = String(data.id ?? data.tx_ref ?? '');
  if (!transactionKey) {
    return { handled: false, reason: 'MISSING_EVENT_KEY' };
  }
  const eventKey = `${eventType}:${transactionKey}`;

  let eventId: string;
  try {
    const event = await prisma.webhookEvent.create({
      data: {
        provider: 'flutterwave',
        eventKey,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: WebhookStatus.RECEIVED,
      },
    });
    eventId = event.id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;

    const existing = await prisma.webhookEvent.findUnique({
      where: { provider_eventKey: { provider: 'flutterwave', eventKey } },
      select: { id: true, status: true },
    });

    // Already settled — genuinely a redelivery.
    if (
      existing &&
      (existing.status === WebhookStatus.PROCESSED || existing.status === WebhookStatus.IGNORED)
    ) {
      log.info({ eventKey }, 'duplicate webhook ignored');
      return { handled: true, reason: 'DUPLICATE' };
    }

    if (!existing) return { handled: true, reason: 'DUPLICATE' };

    // Previous attempt failed or never finished — retry it.
    log.warn({ eventKey, previousStatus: existing.status }, 'retrying previously failed webhook');
    eventId = existing.id;
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: WebhookStatus.RECEIVED, error: null, payload: payload as Prisma.InputJsonValue },
    });
  }

  try {
    // Never trust the webhook body's status field — read it back from the API.
    const transactionId = data.id ? String(data.id) : null;
    const verified = transactionId
      ? await flutterwave.verifyTransaction(transactionId)
      : await flutterwave.verifyByReference(String(data.tx_ref ?? ''));

    if (!verified) {
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: WebhookStatus.IGNORED, error: 'Transaction not found at provider', processedAt: new Date() },
      });
      return { handled: false, reason: 'NOT_FOUND_AT_PROVIDER' };
    }

    const result = await confirmFromProvider(verified);

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: result.applied ? WebhookStatus.PROCESSED : WebhookStatus.IGNORED,
        error: result.applied ? null : (result.reason ?? null),
        processedAt: new Date(),
      },
    });

    return { handled: true, reason: result.reason ?? 'PROCESSED' };
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: WebhookStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
        processedAt: new Date(),
      },
    });
    throw err;
  }
};

/**
 * Called when the customer returns from checkout, and by the reconciliation
 * worker. Safe to call repeatedly.
 */
export const verifyAndSync = async (reference: string, userId?: string) => {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { booking: { select: { id: true, reference: true, status: true } } },
  });

  if (!payment) throw new NotFoundError('Payment');
  if (userId && payment.userId !== userId) throw new NotFoundError('Payment');

  if (payment.status !== PaymentStatus.SUCCESSFUL) {
    const verified = payment.providerTransactionId
      ? await flutterwave.verifyTransaction(payment.providerTransactionId)
      : await flutterwave.verifyByReference(reference);

    if (verified) await confirmFromProvider(verified);
  }

  const fresh = await prisma.payment.findUniqueOrThrow({
    where: { reference },
    include: { booking: { select: { id: true, reference: true, status: true, paymentStatus: true } } },
  });

  return {
    reference: fresh.reference,
    status: fresh.status,
    amount: fresh.amount,
    currency: fresh.currency,
    formattedAmount: formatMoney(fresh.amount, fresh.currency),
    paidAt: fresh.paidAt,
    channel: fresh.channel,
    booking: fresh.booking,
  };
};

/** Payment history for the customer's profile screen. */
export const listPayments = (userId: string) =>
  prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      reference: true,
      amount: true,
      currency: true,
      status: true,
      channel: true,
      paidAt: true,
      createdAt: true,
      booking: { select: { id: true, reference: true, serviceType: true } },
    },
  });

/**
 * Expires an unpaid booking whose payment window has elapsed, freeing the slot
 * for someone else.
 */
export const expireUnpaidBooking = async (bookingId: string): Promise<boolean> => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return false;
  if (booking.status !== BookingStatus.PENDING_PAYMENT) return false;

  const ageMinutes = (Date.now() - booking.createdAt.getTime()) / 60_000;
  if (ageMinutes < env.PAYMENT_EXPIRY_MINUTES) return false;

  // A payment could have landed between the check and here.
  if (booking.paymentStatus === PaymentStatus.SUCCESSFUL) return false;

  await transitionBooking(bookingId, BookingStatus.CANCELLED, {
    reason: 'Payment was not completed in time',
  });

  await prisma.payment.updateMany({
    where: { bookingId, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
    data: { status: PaymentStatus.CANCELLED, failureReason: 'Booking expired before payment' },
  });

  log.info({ bookingId }, 'unpaid booking expired');
  return true;
};
