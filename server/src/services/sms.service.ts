import { env } from '../config/env';
import { createLogger } from '../lib/logger';
import { maskPhone } from '../lib/phone';
import { describeSendchampError, isAccepted, sendchamp } from './sendchamp.client';

const log = createLogger('sms');

export interface SmsMessage {
  to: string;
  message: string;
}

export interface SmsResult {
  delivered: boolean;
  providerId?: string;
  error?: string;
}

/**
 * Providers sit behind this one function so swapping Sendchamp for anything
 * else touches a single file (trsa.md §12).
 */
type SmsDriver = (message: SmsMessage) => Promise<SmsResult>;

/** Development driver: writes the message to the log instead of sending it. */
const logDriver: SmsDriver = async ({ to, message }) => {
  log.info({ to: maskPhone(to), message }, 'SMS (log driver — not actually sent)');
  return { delivered: true, providerId: 'log' };
};

/**
 * Sendchamp SMS.
 *
 * `to` is an array even for a single recipient. Numbers go without the leading
 * `+` — we store E.164, so it is stripped here rather than anywhere upstream.
 *
 * The `dnd` route matters in Nigeria: subscribers on the Do-Not-Disturb list
 * will not receive traffic sent over the plain route, and OTPs are exactly the
 * transactional messages that must still arrive.
 */
const sendchampDriver: SmsDriver = async ({ to, message }) => {
  try {
    const { data } = await sendchamp().post('/sms/send', {
      to: [to.replace(/^\+/, '')],
      message,
      sender_name: env.SENDCHAMP_SENDER_NAME,
      route: env.SENDCHAMP_SMS_ROUTE,
    });

    if (!isAccepted(data)) {
      const error = (data as { message?: string })?.message ?? 'Sendchamp rejected the message';
      log.error({ to: maskPhone(to), error }, 'SMS rejected');
      return { delivered: false, error };
    }

    return {
      delivered: true,
      providerId: (data as { data?: { id?: string } })?.data?.id ?? undefined,
    };
  } catch (err) {
    const error = describeSendchampError(err);
    log.error({ to: maskPhone(to), error }, 'SMS send failed');
    return { delivered: false, error };
  }
};

const drivers: Record<typeof env.SMS_PROVIDER, SmsDriver> = {
  log: logDriver,
  sendchamp: sendchampDriver,
};

export const sendSms = (message: SmsMessage): Promise<SmsResult> => drivers[env.SMS_PROVIDER](message);
