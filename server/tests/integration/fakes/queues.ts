/**
 * Stand-in for `src/queues/queues`. Jobs are recorded rather than executed, so
 * a test can assert that work was ENQUEUED without running a worker.
 */

export interface RecordedJob {
  queue: string;
  name: string;
  data: unknown;
}

export const recordedJobs: RecordedJob[] = [];

const makeQueue = (queue: string) => ({
  name: queue,
  add: async (name: string, data: unknown) => {
    recordedJobs.push({ queue, name, data });
    return { id: String(recordedJobs.length) };
  },
  close: async () => undefined,
});

export const QUEUE_NAMES = {
  notification: 'notification',
  payment: 'payment',
  subscription: 'subscription',
  booking: 'booking',
} as const;

export const notificationQueue = makeQueue('notification') as never;
export const paymentQueue = makeQueue('payment') as never;
export const subscriptionQueue = makeQueue('subscription') as never;
export const bookingQueue = makeQueue('booking') as never;

export const allQueues = [notificationQueue, paymentQueue, subscriptionQueue, bookingQueue];

export const closeQueues = async (): Promise<void> => undefined;
export const registerRepeatableJobs = async (): Promise<void> => undefined;

export const __resetQueues = (): void => {
  recordedJobs.length = 0;
};

export const jobsFor = (queue: string): RecordedJob[] =>
  recordedJobs.filter((job) => job.queue === queue);
