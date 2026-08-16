import type { Request, Response } from 'express';
import { created, ok, param } from '../../lib/http';
import { requireUser } from '../../middleware/authenticate';
import { createLogger } from '../../lib/logger';
import { isValidWebhookSignature } from '../../services/flutterwave.service';
import * as service from './payments.service';

const log = createLogger('payments.webhook');

export const initiate = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { bookingId } = req.body as { bookingId: string };
  const result = await service.initiatePayment(bookingId, user.id);
  return created(res, result, 'Payment initiated');
};

export const verify = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const result = await service.verifyAndSync(param(req, 'reference'), user.id);
  return ok(res, result);
};

export const list = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.listPayments(user.id));
};

/**
 * POST /api/v1/payments/webhook
 *
 * Flutterwave retries on any non-2xx, so this always answers 200 once the
 * signature is valid — a processing failure is recorded on the webhook_events
 * row and retried by us, rather than triggering an unbounded provider retry
 * storm. An INVALID signature is the one case that must be rejected outright.
 */
export const webhook = async (req: Request, res: Response) => {
  const signature = req.get('verif-hash');

  if (!isValidWebhookSignature(signature)) {
    log.warn({ ip: req.ip, hasSignature: Boolean(signature) }, 'rejected webhook with invalid signature');
    return res.status(401).json({
      success: false,
      message: 'Invalid signature',
      error: { code: 'INVALID_WEBHOOK_SIGNATURE' },
    });
  }

  try {
    const result = await service.handleWebhook(req.body as Record<string, unknown>);
    return res.status(200).json({ success: true, message: 'Webhook received', data: result });
  } catch (err) {
    log.error({ err }, 'webhook processing failed');
    // Acknowledge anyway; the event is persisted and can be replayed.
    return res.status(200).json({ success: true, message: 'Webhook received' });
  }
};
