import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('push');

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** FCM data payload values must all be strings. */
  data?: Record<string, string>;
}

export interface PushResult {
  delivered: boolean;
  providerId?: string;
  error?: string;
  /**
   * True when FCM says this token is dead — the app was uninstalled, or the
   * token was reissued. The caller should stop sending to it.
   */
  tokenInvalid?: boolean;
}

type PushDriver = (message: PushMessage) => Promise<PushResult>;

const logDriver: PushDriver = async ({ title, body }) => {
  log.info({ title, body }, 'PUSH (log driver — not actually sent)');
  return { delivered: true, providerId: 'log' };
};

/**
 * Firebase Admin is initialised once, lazily, from the service-account
 * credentials. Lazily because most processes (and every test run) never send a
 * push, and there is no reason to open a Google credential exchange for them.
 */
let app: App | null = null;

const firebaseApp = (): App => {
  if (app) return app;
  app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: env.FCM_PROJECT_ID,
      clientEmail: env.FCM_CLIENT_EMAIL,
      privateKey: env.FCM_PRIVATE_KEY,
    }),
  });
  return app;
};

/** FCM's way of saying "this token will never work again". */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const fcmDriver: PushDriver = async ({ token, title, body, data }) => {
  try {
    const messageId = await getMessaging(firebaseApp()).send({
      token,
      notification: { title, body },
      ...(data ? { data } : {}),
      android: {
        priority: 'high',
        notification: { channelId: 'binman-default', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });

    return { delivered: true, providerId: messageId };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    const message = err instanceof Error ? err.message : String(err);

    if (DEAD_TOKEN_CODES.has(code)) {
      // Not a real failure — the device is simply gone. Logged at info so it
      // does not pollute the error stream; every app uninstall produces one.
      log.info({ code }, 'push token is no longer valid');
      return { delivered: false, error: code, tokenInvalid: true };
    }

    log.error({ code, message }, 'push send failed');
    return { delivered: false, error: message };
  }
};

const drivers: Record<typeof env.PUSH_PROVIDER, PushDriver> = {
  log: logDriver,
  fcm: fcmDriver,
};

export const sendPush = (message: PushMessage): Promise<PushResult> =>
  drivers[env.PUSH_PROVIDER](message);
