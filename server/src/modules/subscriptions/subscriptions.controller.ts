import type { Request, Response } from 'express';
import { created, ok, param } from '../../lib/http';
import { requireUser } from '../../middleware/authenticate';
import * as service from './subscriptions.service';
import type { CreateSubscriptionInput } from './subscriptions.schema';

export const create = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const sub = await service.createSubscription(user.id, req.body as CreateSubscriptionInput);
  return created(res, sub, 'Subscription activated');
};

export const list = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.listSubscriptions(user.id));
};

export const detail = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.getSubscription(param(req, 'id'), user.id));
};

export const update = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const sub = await service.updateSubscription(param(req, 'id'), user.id, req.body as never);
  return ok(res, sub, 'Subscription updated');
};

export const cancel = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const sub = await service.cancelSubscription(param(req, 'id'), user.id);
  return ok(res, sub, 'Subscription cancelled');
};
