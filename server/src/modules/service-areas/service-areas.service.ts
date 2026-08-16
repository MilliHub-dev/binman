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
export const resolveServiceArea = async (area: string, city: string): Promise<AreaResolution> => {
  const match = await prisma.serviceArea.findFirst({
    where: {
      name: { equals: area.trim(), mode: 'insensitive' },
      city: { equals: city.trim(), mode: 'insensitive' },
    },
  });

  if (!match) return { area: null, covered: false, waitlisted: false };

  return {
    area: match,
    covered: match.isActive,
    waitlisted: !match.isActive && match.waitlist,
  };
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
