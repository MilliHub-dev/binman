import { Router, type Request, type Response } from 'express';
import { env } from '../../config/env';
import { createLogger } from '../../lib/logger';
import { redis, keys } from '../../lib/redis';
import { tryNormalisePhone } from '../../lib/phone';
import { webhookLimiter } from '../../middleware/rateLimit';
import * as wa from '../../services/whatsapp.service';
import { handleMessage } from './whatsapp.machine';

const log = createLogger('whatsapp.webhook');

export const whatsappRouter: Router = Router();

/**
 * GET /api/v1/whatsapp/webhook
 * Meta's subscription handshake: echo hub.challenge when the verify token
 * matches.
 */
whatsappRouter.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    log.info('whatsapp webhook verified');
    return res.status(200).send(String(challenge ?? ''));
  }

  log.warn('whatsapp webhook verification failed');
  return res.sendStatus(403);
});

/** Extracts the text or interactive-reply id from a Cloud API message. */
const extractInput = (message: Record<string, any>): string | null => {
  if (message.type === 'text') return message.text?.body ?? null;
  if (message.type === 'interactive') {
    const interactive = message.interactive;
    return interactive?.list_reply?.id ?? interactive?.button_reply?.id ?? null;
  }
  if (message.type === 'button') return message.button?.text ?? null;
  return null;
};

/**
 * POST /api/v1/whatsapp/webhook
 *
 * Meta retries aggressively and treats any slow response as a failure, so this
 * acknowledges immediately and processes the conversation turn afterwards.
 */
whatsappRouter.post('/webhook', webhookLimiter, async (req: Request, res: Response) => {
  if (!wa.isValidSignature(req.rawBody, req.get('x-hub-signature-256'))) {
    log.warn({ ip: req.ip }, 'rejected whatsapp webhook with invalid signature');
    return res.sendStatus(401);
  }

  // Acknowledge first — everything below is best-effort.
  res.sendStatus(200);

  try {
    const entries = (req.body?.entry ?? []) as Array<Record<string, any>>;

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages ?? [];

        for (const message of messages) {
          // Meta redelivers on any hiccup; a short-lived key makes each
          // message id single-shot so a booking cannot be created twice.
          const dedupeKey = keys.whatsappDedupe(String(message.id));
          const fresh = await redis.set(dedupeKey, '1', 'EX', 3600, 'NX');
          if (fresh !== 'OK') continue;

          const phone = tryNormalisePhone(String(message.from ?? ''));
          const input = extractInput(message);
          if (!phone || !input) continue;

          await handleMessage(phone, input);
        }
      }
    }
  } catch (err) {
    log.error({ err }, 'whatsapp webhook processing failed');
  }

  return undefined;
});
