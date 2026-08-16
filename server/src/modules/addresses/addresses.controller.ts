import type { Request, Response } from 'express';
import { created, noContent, ok, param } from '../../lib/http';
import { requireUser } from '../../middleware/authenticate';
import * as service from './addresses.service';
import type { CreateAddressInput, UpdateAddressInput } from './addresses.schema';

export const list = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.listAddresses(user.id));
};

export const create = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const address = await service.createAddress(user.id, req.body as CreateAddressInput);
  return created(res, address, 'Address saved');
};

export const update = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const address = await service.updateAddress(user.id, param(req, 'id'), req.body as UpdateAddressInput);
  return ok(res, address, 'Address updated');
};

export const remove = async (req: Request, res: Response) => {
  const user = requireUser(req);
  await service.deleteAddress(user.id, param(req, 'id'));
  return noContent(res);
};

export const setDefault = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const address = await service.setDefaultAddress(user.id, param(req, 'id'));
  return ok(res, address, 'Default address updated');
};
