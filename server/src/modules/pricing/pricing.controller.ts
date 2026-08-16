import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import * as service from './pricing.service';
import type { QuoteInput } from './pricing.schema';

/**
 * POST /api/v1/pricing/quote
 *
 * The endpoint the booking review screen calls before payment. Missing from
 * api.md, but the flow in ui.md §18 cannot work without it.
 */
export const quote = async (req: Request, res: Response) => {
  const input = req.body as QuoteInput;

  let area = input.area;
  let city = input.city;

  // A saved address is the usual case; take its location.
  if (input.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: input.addressId, userId: req.user?.id, deletedAt: null },
      select: { area: true, city: true },
    });
    if (!address) throw new NotFoundError('Address');
    area = address.area;
    city = address.city;
  }

  const result = await service.quote({
    serviceType: input.serviceType,
    ...(input.wasteTypes ? { wasteTypes: input.wasteTypes } : {}),
    ...(input.collectionSize ? { collectionSize: input.collectionSize } : {}),
    ...(input.cleaningType ? { cleaningType: input.cleaningType } : {}),
    ...(input.propertySize ? { propertySize: input.propertySize } : {}),
    ...(area ? { area } : {}),
    ...(city ? { city } : {}),
  });

  return ok(res, result);
};

/** GET /api/v1/pricing — the "From ₦X" figures on the Services screen. */
export const list = async (req: Request, res: Response) => {
  const { serviceAreaId } = req.query as { serviceAreaId?: string };
  return ok(res, await service.priceList(serviceAreaId));
};
