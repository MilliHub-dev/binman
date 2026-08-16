import { env } from '../config/env';
import { createLogger } from '../lib/logger';
import { describeSendchampError, isAccepted, sendchamp } from './sendchamp.client';

const log = createLogger('email');

export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  /** Plain text; wrapped in a minimal HTML shell before sending. */
  body: string;
  html?: string;
}

export interface EmailResult {
  delivered: boolean;
  providerId?: string;
  error?: string;
}

type EmailDriver = (message: EmailMessage) => Promise<EmailResult>;

const logDriver: EmailDriver = async ({ to, subject, body }) => {
  log.info({ to, subject, body }, 'EMAIL (log driver — not actually sent)');
  return { delivered: true, providerId: 'log' };
};

/**
 * Minimal, deliberately plain HTML. Notification copy is short and
 * transactional, and a heavy template is more likely to trip spam filters
 * than to help.
 */
const wrap = (subject: string, body: string): string => `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;">${subject}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-line;">${body}</p>
      <hr style="border:none;border-top:1px solid #e6e8eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#6b7280;">BinMan · Waste collection made simple</p>
    </div>
  </body>
</html>`.trim();

const sendchampDriver: EmailDriver = async ({ to, toName, subject, body, html }) => {
  try {
    const { data } = await sendchamp().post('/email/send', {
      to: [{ email: to, name: toName ?? to }],
      from: { email: env.SENDCHAMP_FROM_EMAIL, name: env.SENDCHAMP_FROM_NAME },
      subject,
      message_body: { type: 'text/html', value: html ?? wrap(subject, body) },
    });

    if (!isAccepted(data)) {
      const error = (data as { message?: string })?.message ?? 'Sendchamp rejected the email';
      log.error({ to, subject, error }, 'email rejected');
      return { delivered: false, error };
    }

    return {
      delivered: true,
      providerId: (data as { data?: { id?: string } })?.data?.id ?? undefined,
    };
  } catch (err) {
    const error = describeSendchampError(err);
    log.error({ to, subject, error }, 'email send failed');
    return { delivered: false, error };
  }
};

const drivers: Record<typeof env.EMAIL_PROVIDER, EmailDriver> = {
  log: logDriver,
  sendchamp: sendchampDriver,
};

export const sendEmail = (message: EmailMessage): Promise<EmailResult> =>
  drivers[env.EMAIL_PROVIDER](message);
