import type { Request, Response } from 'express';
import { created, ok, param } from '../../lib/http';
import { businessToday } from '../../lib/datetime';
import * as service from './time-slots.service';

export const availability = async (req: Request, res: Response) => {
  const { date, days } = req.query as unknown as { date?: string; days: number };
  const from = date ?? businessToday();

  if (days > 1) {
    return ok(res, await service.getAvailabilityRange(from, days));
  }
  return ok(res, await service.getAvailability(from));
};

export const list = async (_req: Request, res: Response) => ok(res, await service.listActiveSlots());

export const create = async (req: Request, res: Response) => {
  const slot = await service.createTimeSlot(req.body as never);
  return created(res, slot, 'Time slot created');
};

export const update = async (req: Request, res: Response) => {
  const slot = await service.updateTimeSlot(param(req, 'id'), req.body as never);
  return ok(res, slot, 'Time slot updated');
};
