import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { strictLimiter, webhookLimiter } from '../../middleware/rateLimit';
import * as controller from './payments.controller';
import { initiatePaymentSchema, referenceParam } from './payments.schema';

export const paymentsRouter: Router = Router();

/**
 * POST /api/v1/payments/webhook
 * Unauthenticated by necessity — Flutterwave calls it. Authenticity comes from
 * the verif-hash signature check inside the handler, and it is declared BEFORE
 * the authenticate middleware below.
 */
paymentsRouter.post('/webhook', webhookLimiter, controller.webhook);

paymentsRouter.use(authenticate);

/** POST /api/v1/payments/initiate */
paymentsRouter.post(
  '/initiate',
  strictLimiter,
  validate({ body: initiatePaymentSchema }),
  controller.initiate,
);

/** GET /api/v1/payments — the customer's payment history. */
paymentsRouter.get('/', controller.list);

/** GET /api/v1/payments/:reference — poll after returning from checkout. */
paymentsRouter.get('/:reference', validate({ params: referenceParam }), controller.verify);
