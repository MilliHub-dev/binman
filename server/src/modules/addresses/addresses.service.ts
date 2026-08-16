import type { Address } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { resolveServiceArea } from '../service-areas/service-areas.service';
import { addressToQuery, geocode } from '../../services/maps.service';
import type { CreateAddressInput, UpdateAddressInput } from './addresses.schema';

export interface AddressView extends Address {
  /** Surfaced so the app can warn before the customer reaches checkout. */
  serviceable: boolean;
}

const withServiceability = (address: Address & { serviceArea?: { isActive: boolean } | null }): AddressView => ({
  ...address,
  serviceable: Boolean(address.serviceArea?.isActive),
});

export const listAddresses = async (userId: string): Promise<AddressView[]> => {
  const addresses = await prisma.address.findMany({
    where: { userId, deletedAt: null },
    include: { serviceArea: { select: { isActive: true } } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return addresses.map(withServiceability);
};

/** Loads an address, enforcing ownership. */
export const getOwnedAddress = async (userId: string, addressId: string): Promise<Address> => {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId, deletedAt: null },
  });
  if (!address) throw new NotFoundError('Address');
  return address;
};

/**
 * Fills in coordinates the client did not supply.
 *
 * The app sends lat/lng when the customer picks a point on the map. When they
 * type the address instead, we geocode it — a dispatcher cannot plot an
 * address with no position, and a driver cannot navigate to one. Best-effort:
 * a Mapbox failure leaves the coordinates null rather than blocking the save.
 */
const resolveCoordinates = async (
  input: Pick<CreateAddressInput, 'addressLine' | 'area' | 'city' | 'state'> & {
    latitude?: number;
    longitude?: number;
  },
): Promise<{ latitude: number | null; longitude: number | null }> => {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return { latitude: input.latitude, longitude: input.longitude };
  }

  const result = await geocode(addressToQuery(input));
  return {
    latitude: result?.latitude ?? null,
    longitude: result?.longitude ?? null,
  };
};

export const createAddress = async (
  userId: string,
  input: CreateAddressInput,
): Promise<AddressView> => {
  // Tagging the area at write time keeps the booking path cheap and lets the
  // app flag an out-of-coverage address as soon as it is saved.
  const resolution = await resolveServiceArea(input.area, input.city);
  const coordinates = await resolveCoordinates(input);

  const existingCount = await prisma.address.count({ where: { userId, deletedAt: null } });
  const shouldBeDefault = input.isDefault || existingCount === 0;

  const address = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        userId,
        label: input.label,
        addressLine: input.addressLine,
        area: input.area,
        city: input.city,
        state: input.state,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        instructions: input.instructions ?? null,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        isDefault: shouldBeDefault,
        serviceAreaId: resolution.area?.id ?? null,
      },
      include: { serviceArea: { select: { isActive: true } } },
    });
  });

  return withServiceability(address);
};

export const updateAddress = async (
  userId: string,
  addressId: string,
  input: UpdateAddressInput,
): Promise<AddressView> => {
  await getOwnedAddress(userId, addressId);

  // Re-resolve only when the location actually moved.
  let serviceAreaId: string | null | undefined;
  let recoded: { latitude: number | null; longitude: number | null } | undefined;

  const locationChanged =
    input.addressLine !== undefined ||
    input.area !== undefined ||
    input.city !== undefined ||
    input.state !== undefined;

  if (locationChanged) {
    const current = await prisma.address.findUniqueOrThrow({ where: { id: addressId } });

    if (input.area !== undefined || input.city !== undefined) {
      const resolution = await resolveServiceArea(input.area ?? current.area, input.city ?? current.city);
      serviceAreaId = resolution.area?.id ?? null;
    }

    // The old coordinates now point somewhere else. Re-geocode unless the
    // client sent fresh ones with the edit.
    if (input.latitude === undefined || input.longitude === undefined) {
      recoded = await resolveCoordinates({
        addressLine: input.addressLine ?? current.addressLine,
        area: input.area ?? current.area,
        city: input.city ?? current.city,
        state: input.state ?? current.state,
      });
    }
  }

  const address = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.address.update({
      where: { id: addressId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
        ...(input.area !== undefined ? { area: input.area } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(recoded ? { latitude: recoded.latitude, longitude: recoded.longitude } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(serviceAreaId !== undefined ? { serviceAreaId } : {}),
      },
      include: { serviceArea: { select: { isActive: true } } },
    });
  });

  return withServiceability(address);
};

/**
 * Soft-delete. Bookings reference the address for their whole life — including
 * completed history a customer may look at years later — so the row must
 * survive. An address with work still scheduled cannot be removed at all.
 */
export const deleteAddress = async (userId: string, addressId: string): Promise<void> => {
  const address = await getOwnedAddress(userId, addressId);

  const activeBookings = await prisma.booking.count({
    where: {
      addressId,
      status: { notIn: ['COMPLETED', 'CANCELLED', 'FAILED'] },
    },
  });

  if (activeBookings > 0) {
    throw new ConflictError(
      'This address has active bookings. Cancel or complete them first.',
      'ADDRESS_IN_USE',
    );
  }

  const activeSubscriptions = await prisma.subscription.count({
    where: { addressId, status: 'ACTIVE' },
  });

  if (activeSubscriptions > 0) {
    throw new ConflictError(
      'This address is used by an active subscription. Cancel the subscription first.',
      'ADDRESS_IN_USE',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.address.update({
      where: { id: addressId },
      data: { deletedAt: new Date(), isDefault: false },
    });

    // Never leave the customer without a default.
    if (address.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
};

export const setDefaultAddress = async (userId: string, addressId: string): Promise<AddressView> => {
  await getOwnedAddress(userId, addressId);
  const address = await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
      include: { serviceArea: { select: { isActive: true } } },
    });
  });
  return withServiceability(address);
};
