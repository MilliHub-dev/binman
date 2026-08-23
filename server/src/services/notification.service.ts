import { NotificationChannel, NotificationStatus, type Booking } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { notificationQueue } from '../queues/queues';
import { formatDateOnly, minutesToDisplay } from '../lib/datetime';

const log = createLogger('notifications');

/**
 * A single façade over push / SMS / WhatsApp / email, so providers can be
 * swapped without touching business logic (trsa.md §12).
 *
 * Sending is asynchronous by design: the booking flow must never be slowed
 * down — or failed — by a notification provider. Rows are written immediately
 * (so the in-app feed is correct) and delivery is queued.
 */

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  /** Defaults to the user's enabled channels. */
  channels?: NotificationChannel[];
  metadata?: Record<string, unknown>;
}

const DEFAULT_CHANNELS: NotificationChannel[] = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
];

/**
 * Honours the customer's notification preferences. IN_APP is always written —
 * it is the notifications screen, not an outbound message.
 */
const resolveChannels = async (
  userId: string,
  requested: NotificationChannel[],
): Promise<NotificationChannel[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushEnabled: true, smsEnabled: true, whatsappEnabled: true, emailEnabled: true, pushToken: true },
  });
  if (!user) return [];

  return requested.filter((channel) => {
    switch (channel) {
      case NotificationChannel.IN_APP:
        return true;
      case NotificationChannel.PUSH:
        return user.pushEnabled && Boolean(user.pushToken);
      case NotificationChannel.SMS:
        return user.smsEnabled;
      case NotificationChannel.WHATSAPP:
        return user.whatsappEnabled;
      case NotificationChannel.EMAIL:
        return user.emailEnabled;
      default:
        return false;
    }
  });
};

export const notify = async (input: NotificationInput): Promise<void> => {
  try {
    const channels = await resolveChannels(input.userId, input.channels ?? DEFAULT_CHANNELS);
    if (channels.length === 0) return;

    const created = await prisma.$transaction(
      channels.map((channel) =>
        prisma.notification.create({
          data: {
            userId: input.userId,
            channel,
            type: input.type,
            title: input.title,
            message: input.message,
            metadata: (input.metadata ?? undefined) as never,
            // IN_APP needs no delivery step — writing the row IS the delivery.
            status: channel === NotificationChannel.IN_APP ? NotificationStatus.SENT : NotificationStatus.QUEUED,
            ...(channel === NotificationChannel.IN_APP ? { sentAt: new Date() } : {}),
          },
          select: { id: true, channel: true },
        }),
      ),
    );

    await Promise.all(
      created
        .filter((n) => n.channel !== NotificationChannel.IN_APP)
        .map((n) => notificationQueue.add('deliver', { notificationId: n.id })),
    );
  } catch (err) {
    // A failed notification must never fail the operation that triggered it.
    log.error({ err, userId: input.userId, type: input.type }, 'failed to queue notification');
  }
};

// ---------------------------------------------------------------------------
// Templates — the exact messages from prd.md §17 and ui.md §37.
// ---------------------------------------------------------------------------

type BookingLike = Pick<Booking, 'id' | 'reference' | 'scheduledDate' | 'userId'> & {
  timeSlot?: { startTime: number } | null;
  /** Optional so existing callers passing a narrow object still compile. */
  serviceType?: Booking['serviceType'];
};

/** "pickup" or "cleaning", for copy that reads naturally for both services. */
const serviceWord = (booking: BookingLike): string =>
  booking.serviceType === 'CLEANING' ? 'cleaning' : 'pickup';

const whenText = (booking: BookingLike): string => {
  const date = formatDateOnly(booking.scheduledDate);
  const time = booking.timeSlot ? ` at ${minutesToDisplay(booking.timeSlot.startTime)}` : '';
  return `${date}${time}`;
};

export const notifyBookingConfirmed = (booking: BookingLike) =>
  notify({
    userId: booking.userId,
    type: 'BOOKING_CONFIRMED',
    title: 'Pickup booked',
    message: `Your waste pickup ${booking.reference} has been scheduled for ${whenText(booking)}.`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.WHATSAPP],
    metadata: { bookingId: booking.id, reference: booking.reference },
  });

export const notifyTeamAssigned = (booking: BookingLike, driverName: string | null) =>
  notify({
    userId: booking.userId,
    type: 'TEAM_ASSIGNED',
    title: 'Team assigned',
    message: driverName
      ? `${driverName} will handle your ${booking.reference} pickup on ${whenText(booking)}.`
      : `A collection team has been assigned to ${booking.reference}.`,
    metadata: { bookingId: booking.id },
  });

export const notifyDriverEnRoute = (booking: BookingLike) =>
  notify({
    userId: booking.userId,
    type: 'DRIVER_EN_ROUTE',
    title: 'Your collection team is on the way',
    message: 'Your collection team is on the way. Please have your waste ready.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.WHATSAPP],
    metadata: { bookingId: booking.id },
  });

export const notifyDriverArrived = (booking: BookingLike) =>
  notify({
    userId: booking.userId,
    type: 'DRIVER_ARRIVED',
    title: 'Your collection team has arrived',
    message: 'Your collection team has arrived. Please have your waste ready.',
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.WHATSAPP],
    metadata: { bookingId: booking.id },
  });

export const notifyCollectionCompleted = (booking: BookingLike) =>
  notify({
    userId: booking.userId,
    type: 'BOOKING_COMPLETED',
    title: 'Pickup completed',
    message: `Your waste has been successfully collected. Thanks for using BinMan!`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.WHATSAPP],
    metadata: { bookingId: booking.id, reference: booking.reference },
  });

/**
 * How long after completion to ask. Long enough that the customer has been
 * outside and seen the bin, short enough that the job is still fresh.
 */
export const REVIEW_REQUEST_DELAY_MS = 2 * 60 * 60 * 1000;

/**
 * Asks for a rating once the job is done.
 *
 * Sent a little after completion rather than the moment the truck pulls away —
 * the customer has usually not been to the bin yet, and a rating asked before
 * they have seen the result measures nothing.
 */
export const notifyReviewRequest = (booking: BookingLike) =>
  notify({
    userId: booking.userId,
    type: 'REVIEW_REQUEST',
    title: 'How did we do?',
    message: `Tell us how your ${serviceWord(booking)} went — it takes a few seconds.`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    metadata: { bookingId: booking.id, reference: booking.reference },
  });

/**
 * Tells a customer their issue was dealt with.
 *
 * Without this a ticket was a one-way street: someone reported a missed pickup,
 * a dispatcher fixed it and marked it resolved, and the customer was never told
 * anything — so as far as they knew they had been ignored.
 */
export const notifyTicketResolved = (ticket: {
  userId: string;
  ticketNumber: string;
  subject: string;
}) =>
  notify({
    userId: ticket.userId,
    type: 'TICKET_RESOLVED',
    title: 'Your issue has been resolved',
    message: `"${ticket.subject}" (${ticket.ticketNumber}) has been marked resolved. Reply to us if it is still not right.`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    metadata: { ticketNumber: ticket.ticketNumber },
  });

/**
 * A member of staff has answered a support ticket.
 *
 * The preview is trimmed rather than sent whole: a notification is a nudge to
 * open the thread, and a long reply would be truncated by the operating system
 * mid-sentence anyway.
 */
export const notifyTicketReply = (input: {
  userId: string;
  ticketNumber: string;
  preview: string;
}) =>
  notify({
    userId: input.userId,
    type: 'TICKET_REPLY',
    title: 'Support replied',
    message:
      input.preview.length > 120 ? `${input.preview.slice(0, 117).trimEnd()}…` : input.preview,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    metadata: { ticketNumber: input.ticketNumber },
  });

export const notifyBookingCancelled = (booking: BookingLike, reason?: string | null) =>
  notify({
    userId: booking.userId,
    type: 'BOOKING_CANCELLED',
    title: 'Booking cancelled',
    message: `Booking ${booking.reference} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    metadata: { bookingId: booking.id },
  });

export const notifyCollectionFailed = (booking: BookingLike, reason: string) =>
  notify({
    userId: booking.userId,
    type: 'BOOKING_FAILED',
    title: 'We could not complete your pickup',
    message: `We were unable to complete ${booking.reference}. Reason: ${reason}. Our team will be in touch.`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.SMS],
    metadata: { bookingId: booking.id },
  });

export const notifyPaymentReceived = (booking: BookingLike, amountText: string) =>
  notify({
    userId: booking.userId,
    type: 'PAYMENT_RECEIVED',
    title: 'Payment received',
    message: `We received your payment of ${amountText} for booking ${booking.reference}.`,
    metadata: { bookingId: booking.id },
  });

export const notifyPickupReminder = (booking: BookingLike) =>
  notify({
    userId: booking.userId,
    type: 'PICKUP_REMINDER',
    title: 'Pickup reminder',
    message: `Reminder: your pickup ${booking.reference} is scheduled for ${whenText(booking)}.`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.WHATSAPP],
    metadata: { bookingId: booking.id },
  });

/**
 * Everything that should happen when a job is finished.
 *
 * A single function because there are two ways a booking reaches COMPLETED —
 * the driver marking it done, and a member of staff overriding the status — and
 * only the driver's path was telling the customer anything. An admin completing
 * a booking sent no notification at all.
 */
export const onBookingCompleted = async (booking: BookingLike): Promise<void> => {
  await notifyCollectionCompleted(booking);

  const { bookingQueue } = await import('../queues/queues');
  const { reviewRequestJobId } = await import('../queues/jobIds');

  await bookingQueue.add(
    'review-request',
    { bookingId: booking.id, kind: 'REVIEW_REQUEST' },
    {
      delay: REVIEW_REQUEST_DELAY_MS,
      // Stable per booking, so a repeated completion cannot ask twice.
      jobId: reviewRequestJobId(booking.id),
    },
  );
};
