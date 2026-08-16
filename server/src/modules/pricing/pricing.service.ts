import {
  type CleaningType,
  type CollectionSize,
  type PricingRule,
  type PropertySize,
  ServiceType,
  type WasteType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { BadRequestError } from '../../lib/errors';
import { formatMoney } from '../../lib/money';
import { resolveServiceArea } from '../service-areas/service-areas.service';

/**
 * Pricing is entirely admin-driven — no price is ever hardcoded in a client
 * (prd.md §12). A quote is computed here, on the server, and the booking stores
 * a snapshot of the numbers so a later price change cannot rewrite history.
 */

export interface QuoteRequest {
  serviceType: ServiceType;
  /** Waste jobs price on the largest selected category + size. */
  wasteTypes?: WasteType[];
  collectionSize?: CollectionSize;
  cleaningType?: CleaningType;
  propertySize?: PropertySize;
  /** Either an explicit area id, or the (area, city) to resolve one from. */
  serviceAreaId?: string | null;
  area?: string;
  city?: string;
}

export interface Quote {
  subtotal: number;
  serviceFee: number;
  discount: number;
  total: number;
  currency: string;
  /** Which rule produced the price — shown in admin, useful in support. */
  pricingRuleId: string | null;
  serviceAreaId: string | null;
  breakdown: Array<{ label: string; amount: number }>;
  formatted: { subtotal: string; serviceFee: string; total: string };
}

/**
 * Rules use null as a wildcard, so several may match one request. The most
 * specific wins; ties break toward the most recently effective rule.
 */
const specificity = (rule: PricingRule): number =>
  (rule.serviceAreaId ? 8 : 0) +
  (rule.wasteType ? 4 : 0) +
  (rule.cleaningType ? 4 : 0) +
  (rule.collectionSize ? 2 : 0) +
  (rule.propertySize ? 2 : 0);

const isApplicable = (rule: PricingRule, req: QuoteRequest, areaId: string | null): boolean => {
  if (rule.serviceType !== req.serviceType) return false;
  if (rule.serviceAreaId && rule.serviceAreaId !== areaId) return false;

  if (req.serviceType === ServiceType.WASTE_COLLECTION) {
    if (rule.wasteType && !(req.wasteTypes ?? []).includes(rule.wasteType)) return false;
    if (rule.collectionSize && rule.collectionSize !== req.collectionSize) return false;
    return true;
  }

  if (rule.cleaningType && rule.cleaningType !== req.cleaningType) return false;
  if (rule.propertySize && rule.propertySize !== req.propertySize) return false;
  return true;
};

const resolveAreaId = async (req: QuoteRequest): Promise<string | null> => {
  if (req.serviceAreaId !== undefined && req.serviceAreaId !== null) return req.serviceAreaId;
  if (req.area && req.city) {
    const resolution = await resolveServiceArea(req.area, req.city);
    return resolution.area?.id ?? null;
  }
  return null;
};

export const findApplicableRule = async (req: QuoteRequest): Promise<{
  rule: PricingRule | null;
  serviceAreaId: string | null;
}> => {
  const serviceAreaId = await resolveAreaId(req);
  const now = new Date();

  const candidates = await prisma.pricingRule.findMany({
    where: {
      serviceType: req.serviceType,
      isActive: true,
      effectiveFrom: { lte: now },
      AND: [
        // Currently in effect.
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
        // Nationwide rules, plus rules scoped to this specific area.
        { OR: [{ serviceAreaId: null }, ...(serviceAreaId ? [{ serviceAreaId }] : [])] },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  const applicable = candidates
    .filter((rule) => isApplicable(rule, req, serviceAreaId))
    .sort((a, b) => {
      const diff = specificity(b) - specificity(a);
      if (diff !== 0) return diff;
      return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    });

  return { rule: applicable[0] ?? null, serviceAreaId };
};

/**
 * Produces the price shown on the review screen and charged at checkout.
 *
 * Throws rather than guessing when no rule covers the request: an unpriced
 * combination is a configuration gap the operations team must fix, not
 * something to paper over with a default.
 */
export const quote = async (req: QuoteRequest): Promise<Quote> => {
  if (req.serviceType === ServiceType.WASTE_COLLECTION && !req.collectionSize) {
    throw new BadRequestError('Collection size is required for a waste pickup', 'SIZE_REQUIRED');
  }
  if (req.serviceType === ServiceType.CLEANING && (!req.cleaningType || !req.propertySize)) {
    throw new BadRequestError(
      'Cleaning type and property size are required for a cleaning booking',
      'CLEANING_DETAILS_REQUIRED',
    );
  }

  const { rule, serviceAreaId } = await findApplicableRule(req);

  if (!rule) {
    throw new BadRequestError(
      'We could not price this service for your location yet. Please contact support.',
      'NO_PRICE_CONFIGURED',
    );
  }

  const area = serviceAreaId
    ? await prisma.serviceArea.findUnique({ where: { id: serviceAreaId }, select: { surcharge: true, name: true } })
    : null;

  const surcharge = area?.surcharge ?? 0;
  const subtotal = rule.basePrice + surcharge;
  // A rule may override the platform-wide fee with its own.
  const serviceFee = rule.serviceFee > 0 ? rule.serviceFee : env.DEFAULT_SERVICE_FEE;
  const discount = 0;
  const total = subtotal + serviceFee - discount;

  const breakdown = [
    { label: req.serviceType === ServiceType.WASTE_COLLECTION ? 'Collection' : 'Cleaning', amount: rule.basePrice },
    ...(surcharge > 0 ? [{ label: `${area?.name ?? 'Area'} surcharge`, amount: surcharge }] : []),
    { label: 'Service fee', amount: serviceFee },
  ];

  return {
    subtotal,
    serviceFee,
    discount,
    total,
    currency: rule.currency,
    pricingRuleId: rule.id,
    serviceAreaId,
    breakdown,
    formatted: {
      subtotal: formatMoney(subtotal, rule.currency),
      serviceFee: formatMoney(serviceFee, rule.currency),
      total: formatMoney(total, rule.currency),
    },
  };
};

/**
 * Every price the Services screen shows as "From ₦X" (ui.md §28).
 */
export const priceList = async (serviceAreaId?: string) => {
  const now = new Date();
  const rules = await prisma.pricingRule.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: now },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
        { OR: [{ serviceAreaId: null }, ...(serviceAreaId ? [{ serviceAreaId }] : [])] },
      ],
    },
    orderBy: [{ serviceType: 'asc' }, { basePrice: 'asc' }],
  });

  return rules.map((rule) => ({
    id: rule.id,
    serviceType: rule.serviceType,
    wasteType: rule.wasteType,
    collectionSize: rule.collectionSize,
    cleaningType: rule.cleaningType,
    propertySize: rule.propertySize,
    serviceAreaId: rule.serviceAreaId,
    basePrice: rule.basePrice,
    serviceFee: rule.serviceFee > 0 ? rule.serviceFee : env.DEFAULT_SERVICE_FEE,
    currency: rule.currency,
    formatted: formatMoney(rule.basePrice, rule.currency),
  }));
};
