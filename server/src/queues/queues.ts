import { Queue, type JobsOptions } from 'bullmq';
import { queueConnection } from '../lib/redis';

/**
 * Background work runs off the request path (trsa.md §8): notifications, payment
 * reconciliation, recurring booking generation and reminders.
 */

export const QUEUE_NAMES = {
  notification: 'notification',
  payment: 'payment',
  subscription: 'subscription',
  booking: 'booking',
} as const;

/**
 * Retries are exponential, so a provider blip recovers on its own. Completed
 * jobs are trimmed to keep Redis small; failed jobs are kept far longer
 * because they are the ones anyone will want to inspect.
 */
const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 1000, age: 24 * 3600 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

const make = <T>(name: string) =>
  new Queue<T>(name, { connection: queueConnection, defaultJobOptions });

export interface NotificationJob {
  notificationId: string;
}

export interface PaymentVerificationJob {
  paymentReference: string;
  /** How many times we have already polled the provider. */
  attempt?: number;
}

export interface SubscriptionRunJob {
  /** Omitted for the scheduled sweep across every due subscription. */
  subscriptionId?: string;
}

export interface BookingReminderJob {
  bookingId: string;
  kind: 'DAY_BEFORE' | 'EXPIRE_UNPAID';
}

export const notificationQueue = make<NotificationJob>(QUEUE_NAMES.notification);
export const paymentQueue = make<PaymentVerificationJob>(QUEUE_NAMES.payment);
export const subscriptionQueue = make<SubscriptionRunJob>(QUEUE_NAMES.subscription);
export const bookingQueue = make<BookingReminderJob>(QUEUE_NAMES.booking);

export const allQueues = [notificationQueue, paymentQueue, subscriptionQueue, bookingQueue];

export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled(allQueues.map((q) => q.close()));
};

/**
 * Repeatable jobs, registered once at boot. BullMQ deduplicates by job id, so
 * restarting the process does not stack duplicate schedules.
 */
export const registerRepeatableJobs = async (): Promise<void> => {
  // Generate the next occurrence for every due subscription, daily at 01:00.
  await subscriptionQueue.add(
    'sweep',
    {},
    { repeat: { pattern: '0 1 * * *' }, jobId: 'subscription-sweep' },
  );
};
