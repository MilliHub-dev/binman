import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './subscriptions.controller';
import {
  createSubscriptionSchema,
  subscriptionIdParam,
  updateSubscriptionSchema,
} from './subscriptions.schema';

export const subscriptionsRouter: Router = Router();

subscriptionsRouter.use(authenticate);

/** POST /api/v1/subscriptions */
subscriptionsRouter.post('/', validate({ body: createSubscriptionSchema }), controller.create);

/** GET /api/v1/subscriptions */
subscriptionsRouter.get('/', controller.list);

/** GET /api/v1/subscriptions/:id */
subscriptionsRouter.get('/:id', validate({ params: subscriptionIdParam }), controller.detail);

/** PATCH /api/v1/subscriptions/:id — also pause/resume. */
subscriptionsRouter.patch(
  '/:id',
  validate({ params: subscriptionIdParam, body: updateSubscriptionSchema }),
  controller.update,
);

/** POST /api/v1/subscriptions/:id/cancel */
subscriptionsRouter.post('/:id/cancel', validate({ params: subscriptionIdParam }), controller.cancel);
