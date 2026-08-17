import { Worker, type Job } from 'bullmq';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { queueConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { paymentVerifyJobId } from './jobIds';
import { createLogger } from '../lib/logger';
import { sendSms } from '../services/sms.service';
import { sendEmail } from '../services/email.service';
import { sendPush } from '../services/push.service';
import { sendText } from '../services/whatsapp.service';
import {
  QUEUE_NAMES,
  registerRepeatableJobs,
  type BookingReminderJob,
  type NotificationJob,
  type PaymentVerificationJob,
  type SubscriptionRunJob,
} from './queues';
import * as paymentsService from '../modules/payments/payments.service';
import { runDueSubscriptions, generateNextBooking } from '../modules/subscriptions/subscriptions.service';
import * as notifications from '../services/notification.service';

const log = createLogger('worker');

/**
 * Background worker process (trsa.md §8). Runs separately from the API so a
 * burst of notifications or a slow provider never affects request latency:
 *
 *   npm run dev:worker      # development
 *   npm run start:worker    # production
 */

const CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Notification delivery
// ---------------------------------------------------------------------------

const deliverNotification = async (job: Job<NotificationJob>): Promise<void> => {
  const notification = await prisma.notification.findUnique({
    where: { id: job.data.notificationId },
    include: {
      user: { select: { phone: true, email: true, pushToken: true, firstName: true, lastName: true } },
    },
  });

  if (!notification) return;
  if (notification.status === NotificationStatus.SENT) return;

  let delivered = false;
  let error: string | null = null;
  // Kept so the Sendchamp delivery webhook can find this row later.
  let providerMessageId: string | null = null;
  /**
   * A failure that retrying cannot fix — a missing email address, a push token
   * FCM has told us is dead. Recorded as FAILED without burning five retries
   * and a minute of backoff on an outcome that will never change.
   */
  let permanent = false;

  switch (notification.channel) {
    case NotificationChannel.SMS: {
      const result = await sendSms({ to: notification.user.phone, message: notification.message });
      delivered = result.delivered;
      error = result.error ?? null;
      providerMessageId = result.providerId ?? null;
      break;
    }
    case NotificationChannel.WHATSAPP: {
      delivered = await sendText(
        notification.user.phone,
        `*${notification.title}*\n\n${notification.message}`,
      );
      if (!delivered) error = 'WhatsApp send failed';
      break;
    }
    case NotificationChannel.PUSH: {
      if (!notification.user.pushToken) {
        error = 'No push token registered';
        permanent = true;
        break;
      }
      const result = await sendPush({
        token: notification.user.pushToken,
        title: notification.title,
        body: notification.message,
        data: { notificationId: notification.id, type: notification.type },
      });
      delivered = result.delivered;
      error = result.error ?? null;
      providerMessageId = result.providerId ?? null;

      if (result.tokenInvalid) {
        // The app was uninstalled or the token was reissued. Clear it so every
        // future notification for this user stops attempting a dead device.
        permanent = true;
        await prisma.user.update({
          where: { id: notification.userId },
          data: { pushToken: null },
        });
        log.info({ userId: notification.userId }, 'cleared dead push token');
      }
      break;
    }
    case NotificationChannel.EMAIL: {
      // Phone is the primary identity, so email is optional on an account.
      if (!notification.user.email) {
        error = 'No email address on file';
        permanent = true;
        break;
      }
      const fullName =
        [notification.user.firstName, notification.user.lastName].filter(Boolean).join(' ') || undefined;
      const result = await sendEmail({
        to: notification.user.email,
        ...(fullName ? { toName: fullName } : {}),
        subject: notification.title,
        body: notification.message,
      });
      delivered = result.delivered;
      error = result.error ?? null;
      providerMessageId = result.providerId ?? null;
      break;
    }
    default:
      delivered = true;
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      // SENT means handed to the provider. It only becomes DELIVERED when the
      // provider's webhook confirms it actually arrived.
      status: delivered ? NotificationStatus.SENT : NotificationStatus.FAILED,
      sentAt: delivered ? new Date() : null,
      providerMessageId,
      error,
    },
  });

  // Throwing lets BullMQ retry with backoff — but only where a retry could
  // plausibly succeed.
  if (!delivered && !permanent) throw new Error(error ?? 'Notification delivery failed');
};

// ---------------------------------------------------------------------------
// Payment reconciliation
// ---------------------------------------------------------------------------

/**
 * Safety net for a webhook that never arrived. Polls the provider a few times
 * with widening gaps, then expires the booking so the slot is released.
 */
const verifyPayment = async (job: Job<PaymentVerificationJob>): Promise<void> => {
  const { paymentReference } = job.data;
  const attempt = job.data.attempt ?? 1;

  const payment = await prisma.payment.findUnique({
    where: { reference: paymentReference },
    select: { status: true, bookingId: true },
  });

  if (!payment) return;
  if (payment.status === 'SUCCESSFUL' || payment.status === 'CANCELLED') return;

  const result = await paymentsService.verifyAndSync(paymentReference);

  if (result.status === 'SUCCESSFUL') {
    log.info({ paymentReference }, 'payment reconciled by worker');
    return;
  }

  if (attempt >= 3) {
    if (payment.bookingId) await paymentsService.expireUnpaidBooking(payment.bookingId);
    return;
  }

  const { paymentQueue } = await import('./queues');
  await paymentQueue.add(
    'verify',
    { paymentReference, attempt: attempt + 1 },
    { delay: attempt * 10 * 60_000, jobId: paymentVerifyJobId(paymentReference, attempt + 1) },
  );
};

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

const runSubscriptions = async (job: Job<SubscriptionRunJob>): Promise<void> => {
  if (job.data.subscriptionId) {
    await generateNextBooking(job.data.subscriptionId);
    return;
  }
  const result = await runDueSubscriptions();
  log.info(result, 'subscription sweep complete');
};

// ---------------------------------------------------------------------------
// Booking reminders
// ---------------------------------------------------------------------------

const handleBookingJob = async (job: Job<BookingReminderJob>): Promise<void> => {
  const booking = await prisma.booking.findUnique({
    where: { id: job.data.bookingId },
    include: { timeSlot: true },
  });
  if (!booking) return;

  if (job.data.kind === 'EXPIRE_UNPAID') {
    await paymentsService.expireUnpaidBooking(booking.id);
    return;
  }

  if (job.data.kind === 'REVIEW_REQUEST') {
    // Only ask about a job that actually finished, and only once — a customer
    // who already rated must not be nudged about the same booking again.
    if (booking.status !== 'COMPLETED') return;
    const existing = await prisma.review.findUnique({ where: { bookingId: booking.id } });
    if (existing) return;
    await notifications.notifyReviewRequest(booking);
    return;
  }

  // Do not remind someone about a job that is no longer happening.
  if (['CANCELLED', 'FAILED', 'COMPLETED'].includes(booking.status)) return;
  await notifications.notifyPickupReminder(booking);
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const workers: Worker[] = [];

const start = async (): Promise<void> => {
  workers.push(
    new Worker<NotificationJob>(QUEUE_NAMES.notification, deliverNotification, {
      connection: queueConnection,
      concurrency: CONCURRENCY,
    }),
    new Worker<PaymentVerificationJob>(QUEUE_NAMES.payment, verifyPayment, {
      connection: queueConnection,
      concurrency: 3,
    }),
    new Worker<SubscriptionRunJob>(QUEUE_NAMES.subscription, runSubscriptions, {
      connection: queueConnection,
      concurrency: 1,
    }),
    new Worker<BookingReminderJob>(QUEUE_NAMES.booking, handleBookingJob, {
      connection: queueConnection,
      concurrency: CONCURRENCY,
    }),
  );

  for (const worker of workers) {
    worker.on('failed', (job, err) =>
      log.error({ err, queue: worker.name, jobId: job?.id, attempts: job?.attemptsMade }, 'job failed'),
    );
    worker.on('completed', (job) => log.debug({ queue: worker.name, jobId: job.id }, 'job completed'));
  }

  await registerRepeatableJobs();
  log.info({ queues: workers.map((w) => w.name) }, 'workers started');
};

const shutdown = async (signal: string): Promise<void> => {
  log.info({ signal }, 'shutting down workers');
  // Let in-flight jobs finish rather than killing them mid-payment.
  await Promise.allSettled(workers.map((worker) => worker.close()));
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void start().catch((err) => {
  log.fatal({ err }, 'worker failed to start');
  process.exit(1);
});
