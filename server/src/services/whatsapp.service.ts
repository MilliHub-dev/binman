import { createHmac, timingSafeEqual } from 'node:crypto';
import axios from 'axios';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';
import { maskPhone } from '../lib/phone';

const log = createLogger('whatsapp');

/**
 * WhatsApp Cloud API transport. Message CONTENT is decided by the conversation
 * state machine; this module only knows how to put bytes on the wire.
 */

export interface InteractiveOption {
  id: string;
  title: string;
  description?: string;
}

const post = async (payload: Record<string, unknown>): Promise<boolean> => {
  if (!env.WHATSAPP_ENABLED) {
    log.info({ payload }, 'WhatsApp disabled — message not sent');
    return true;
  }

  try {
    await axios.post(
      `${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      { messaging_product: 'whatsapp', ...payload },
      {
        headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
        timeout: 15_000,
      },
    );
    return true;
  } catch (err) {
    const detail = axios.isAxiosError(err) ? (err.response?.data ?? err.message) : String(err);
    log.error({ detail }, 'WhatsApp send failed');
    return false;
  }
};

export const sendText = (to: string, body: string): Promise<boolean> =>
  post({ to, type: 'text', text: { preview_url: false, body } });

/**
 * Interactive list. WhatsApp caps rows at 10 and titles at 24 characters, so
 * options are truncated here rather than failing the whole send.
 */
export const sendList = (
  to: string,
  body: string,
  buttonLabel: string,
  options: InteractiveOption[],
): Promise<boolean> =>
  post({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [
          {
            rows: options.slice(0, 10).map((option) => ({
              id: option.id.slice(0, 200),
              title: option.title.slice(0, 24),
              ...(option.description ? { description: option.description.slice(0, 72) } : {}),
            })),
          },
        ],
      },
    },
  });

/** Reply buttons. WhatsApp allows at most three. */
export const sendButtons = (
  to: string,
  body: string,
  options: InteractiveOption[],
): Promise<boolean> =>
  post({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: options.slice(0, 3).map((option) => ({
          type: 'reply',
          reply: { id: option.id.slice(0, 200), title: option.title.slice(0, 20) },
        })),
      },
    },
  });

/**
 * Meta signs each webhook body with the app secret. Verified against the RAW
 * body — re-serialising parsed JSON would change the bytes and break the
 * comparison.
 */
export const isValidSignature = (rawBody: Buffer | undefined, header: string | undefined): boolean => {
  if (!env.WHATSAPP_APP_SECRET) return true; // Not configured; nothing to verify against.
  if (!rawBody || !header?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex');
  const received = header.slice('sha256='.length);

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export const logInbound = (phone: string, text: string): void => {
  log.info({ phone: maskPhone(phone), text }, 'inbound WhatsApp message');
};
