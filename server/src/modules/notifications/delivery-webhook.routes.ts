import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { NotificationStatus, Prisma, WebhookStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { webhookLimiter } from '../../middleware/rateLimit';

const log = createLogger('sendchamp.webhook');

export const deliveryWebhookRouter: Router = Router();

/**
 * Sendchamp delivery-status callbacks.
 *
 * `SENT` only means we handed the message to Sendchamp. This endpoint is how a
 * notification becomes `DELIVERED` or `FAILED` — without it, a message that
 * silently never reached the handset stays recorded as sent, and support has no
 * way to tell a customer who says "I never got the code" what actually
 * happened.
 *
 * The endpoint is intentionally low-privilege: the worst a forged callback can
 * do is mislabel a delivery status. It cannot move money, change a booking or
 * read customer data.
 */

/**
 * Verifies the shared secret, in constant time.
 *
 * Sendchamp's signing scheme is not consistently documented across products, so
 * this accepts the secret from any of the headers they are known to use. If
 * your account signs with an HMAC instead, replace this with a digest check
 * over `req.rawBody` — that buffer is already captured in app.ts.
 */
const isAuthentic = (req: Request): boolean => {
  const expected = env.SENDCHAMP_WEBHOOK_SECRET;
  if (!expected) return true; // Not configured — development only.

  const presented =
    req.get('x-sendchamp-signature') ??
    req.get('x-sendchamp-secret') ??
    req.get('verif-hash') ??
    '';

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

/** Sendchamp uses different status vocabularies per product. */
const mapStatus = (raw: unknown): NotificationStatus | null => {
  const value = String(raw ?? '').toLowerCase();
  if (['delivered', 'delivery_success', 'success', 'opened'].includes(value)) {
    return NotificationStatus.DELIVERED;
  }
  if (['failed', 'delivery_failed', 'rejected', 'undelivered', 'bounced'].includes(value)) {
    return NotificationStatus.FAILED;
  }
  if (['sent', 'submitted', 'queued', 'pending'].includes(value)) return NotificationStatus.SENT;
  return null;
};

/**
 * POST /api/v1/webhooks/sendchamp
 *
 * Registered on the Sendchamp dashboard. Always answers 200 once authentic, so
 * a processing problem does not trigger an endless provider retry loop — the
 * raw event is persisted and can be replayed.
 */
deliveryWebhookRouter.post('/sendchamp', webhookLimiter, async (req: Request, res: Response) => {
  if (!isAuthentic(req)) {
    log.warn({ ip: req.ip }, 'rejected sendchamp webhook with invalid secret');
    return res.status(401).json({
      success: false,
      message: 'Invalid signature',
      error: { code: 'INVALID_WEBHOOK_SIGNATURE' },
    });
  }

  const payload = (req.body ?? {}) as Record<string, unknown>;
  const data = (payload.data ?? payload) as Record<string, unknown>;

  // Sendchamp varies the id field by product; take the first one present.
  const messageId = String(
    data.message_id ?? data.id ?? data.reference ?? data.sms_id ?? data.email_id ?? '',
  );
  const status = mapStatus(data.status ?? payload.status ?? payload.event);

  if (!messageId) {
    log.warn({ payload }, 'sendchamp webhook had no message id');
    return res.status(200).json({ success: true, message: 'Ignored — no message id' });
  }

  // Persisted before processing, and deduplicated by the unique
  // (provider, eventKey) index — same contract as the payment webhook.
  const eventKey = `${messageId}:${status ?? 'unknown'}`;
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: 'sendchamp',
        eventKey,
        eventType: String(payload.event ?? data.status ?? 'delivery_status'),
        payload: payload as Prisma.InputJsonValue,
        status: WebhookStatus.RECEIVED,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(200).json({ success: true, message: 'Duplicate ignored' });
    }
    log.error({ err }, 'failed to persist sendchamp webhook');
    return res.status(200).json({ success: true, message: 'Received' });
  }

  if (!status) {
    return res.status(200).json({ success: true, message: 'Ignored — unrecognised status' });
  }

  // updateMany, not update: an unknown message id is a no-op rather than a
  // crash, and it scopes the write to the row that owns that provider id.
  const result = await prisma.notification.updateMany({
    where: { providerMessageId: messageId },
    data: {
      status,
      ...(status === NotificationStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      ...(status === NotificationStatus.FAILED
        ? { error: String(data.reason ?? data.message ?? 'Provider reported delivery failure') }
        : {}),
    },
  });

  await prisma.webhookEvent.updateMany({
    where: { provider: 'sendchamp', eventKey },
    data: {
      status: result.count > 0 ? WebhookStatus.PROCESSED : WebhookStatus.IGNORED,
      processedAt: new Date(),
      ...(result.count === 0 ? { error: 'No notification matched that message id' } : {}),
    },
  });

  log.info({ messageId, status, matched: result.count }, 'sendchamp delivery status applied');

  return res.status(200).json({ success: true, message: 'Delivery status recorded' });
});
