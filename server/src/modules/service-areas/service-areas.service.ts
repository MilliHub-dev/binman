import type { ServiceArea } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../lib/errors';

export interface AreaResolution {
  area: ServiceArea | null;
  /** True when we cover this location right now. */
  covered: boolean;
  /** True when the area exists but is paused and set to collect a waitlist. */
  waitlisted: boolean;
}

/**
 * Resolves a free-text (area, city) pair to a configured operating area
 * (admin.md §7).
 *
 * Matching is case-insensitive on both fields. An address in an unknown or
 * inactive area is not automatically an error — the caller decides whether to
 * reject it or place it on a waitlist.
 */
/**
 * "Ikot Ekpene Rd" and "Ikot Ekpene Road" are the same street.
 *
 * Geocoders abbreviate inconsistently and customers type whatever they say out
 * loud, so both sides are folded to one spelling before comparison.
 */
const normalise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(rd)\b/g, 'road')
    .replace(/\b(st)\b/g, 'street')
    .replace(/\b(ave|av)\b/g, 'avenue')
    .replace(/\b(cl)\b/g, 'close')
    .replace(/\b(est)\b/g, 'estate')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Decides whether we serve a place, and which area's configuration applies.
 *
 * Matching used to require the area name to equal a seeded one exactly, which
 * refused almost everybody: the seed names nine roads and estates, so a customer
 * on any other street in Uyo — Udo Udoma Avenue, say, which is the example in
 * the app's own placeholder text — was told we do not collect there. The
 * abbreviation "Ikot Ekpene Rd" failed against "Ikot Ekpene Road" for the same
 * reason.
 *
 * So it now widens in three steps: the same street by any spelling, then a
 * street that contains a known area as a whole phrase, and finally the city.
 * Operating anywhere in a city means a truck can reach a side street in it, and
 * refusing a real customer is a far more expensive mistake than accepting one
 * whose street we had not written down. A named area still attaches its own
 * surcharge; an unnamed street in a covered city carries none.
 */
export const resolveServiceArea = async (area: string, city: string): Promise<AreaResolution> => {
  const areasInCity = await prisma.serviceArea.findMany({
    where: { city: { equals: city.trim(), mode: 'insensitive' } },
  });

  if (areasInCity.length === 0) return { area: null, covered: false, waitlisted: false };

  const wanted = normalise(area);

  const match =
    areasInCity.find((candidate) => normalise(candidate.name) === wanted) ??
    areasInCity.find((candidate) => {
      // Whole-phrase, so a short name like "Itam" cannot match "Whitam Close".
      const name = normalise(candidate.name);
      return new RegExp(`\\b${escapeRegExp(name)}\\b`).test(wanted);
    });

  if (match) {
    return { area: match, covered: match.isActive, waitlisted: !match.isActive && match.waitlist };
  }

  /**
   * No named area, but we do operate in this city.
   *
   * The cheapest active area stands in rather than leaving the address with no
   * zone at all: `serviceable` on a saved address is derived from its linked
   * area, so a null one would have the geocoder saying we collect here and the
   * saved address saying we do not. Cheapest, not nearest, because we hold no
   * geometry to measure with — and a street we never wrote down must not
   * inherit another area's surcharge.
   */
  const fallback = areasInCity
    .filter((candidate) => candidate.isActive)
    .sort((a, b) => a.surcharge - b.surcharge)[0];

  if (!fallback) return { area: null, covered: false, waitlisted: false };
  return { area: fallback, covered: true, waitlisted: false };
};


/**
 * Same as `resolveServiceArea`, but throws the customer-facing error when we
 * cannot serve the location. Used on the booking path.
 */
export const assertServiceable = async (area: string, city: string): Promise<ServiceArea> => {
  const resolution = await resolveServiceArea(area, city);

  if (!resolution.area) {
    throw new BadRequestError(
      `We do not currently operate in ${area}, ${city}. We are expanding — please check back soon.`,
      'OUTSIDE_SERVICE_AREA',
    );
  }

  if (!resolution.covered) {
    throw new BadRequestError(
      resolution.waitlisted
        ? `Service in ${resolution.area.name} is paused. Contact support to join the waitlist.`
        : `We are not currently collecting in ${resolution.area.name}.`,
      resolution.waitlisted ? 'SERVICE_AREA_WAITLIST' : 'SERVICE_AREA_INACTIVE',
    );
  }

  return resolution.area;
};

export const listServiceAreas = (onlyActive = true) =>
  prisma.serviceArea.findMany({
    where: onlyActive ? { isActive: true } : {},
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
  });

export const getServiceArea = async (id: string): Promise<ServiceArea> => {
  const area = await prisma.serviceArea.findUnique({ where: { id } });
  if (!area) throw new NotFoundError('Service area');
  return area;
};

export const createServiceArea = (data: {
  name: string;
  city: string;
  state: string;
  surcharge?: number;
  waitlist?: boolean;
  isActive?: boolean;
}) => prisma.serviceArea.create({ data });

export const updateServiceArea = async (
  id: string,
  data: Partial<{
    name: string;
    city: string;
    state: string;
    surcharge: number;
    waitlist: boolean;
    isActive: boolean;
  }>,
) => {
  await getServiceArea(id);
  return prisma.serviceArea.update({ where: { id }, data });
};
