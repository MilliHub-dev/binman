import type { Prisma } from '@prisma/client';
import { formatMoney } from '../../lib/money';
import { formatDateOnly, slotWindowLabel } from '../../lib/datetime';
import { STATUS_LABELS } from './booking.status';
import { toUserSummary } from '../users/user.mapper';

/** The include shape every booking response is built from. */
export const bookingInclude = {
  address: true,
  timeSlot: true,
  wasteBooking: true,
  cleaningBooking: true,
  serviceArea: { select: { id: true, name: true, city: true } },
  assignments: {
    where: { status: { notIn: ['REASSIGNED', 'CANCELLED'] } },
    orderBy: { assignedAt: 'desc' },
    take: 1,
    include: {
      driver: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      truck: { select: { id: true, truckNumber: true, registrationNumber: true, truckType: true } },
      cleaner: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  },
  payments: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      reference: true,
      status: true,
      amount: true,
      provider: true,
      checkoutUrl: true,
      paidAt: true,
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/**
 * One booking shape for every consumer — mobile app, WhatsApp, admin. Prices
 * are returned both as kobo integers (for arithmetic) and formatted strings
 * (so each client does not reimplement Naira formatting).
 */
export const toBookingView = (booking: BookingWithRelations) => {
  const assignment = booking.assignments[0] ?? null;
  const driverUser = assignment?.driver?.user;

  return {
    id: booking.id,
    reference: booking.reference,
    serviceType: booking.serviceType,
    status: booking.status,
    statusLabel: STATUS_LABELS[booking.status],
    paymentStatus: booking.paymentStatus,

    scheduledDate: formatDateOnly(booking.scheduledDate),
    timeSlot: {
      id: booking.timeSlot.id,
      label: booking.timeSlot.label,
      window: slotWindowLabel(booking.timeSlot.startTime, booking.timeSlot.endTime),
      startTime: booking.timeSlot.startTime,
      endTime: booking.timeSlot.endTime,
    },

    address: {
      id: booking.address.id,
      label: booking.address.label,
      addressLine: booking.address.addressLine,
      area: booking.address.area,
      city: booking.address.city,
      state: booking.address.state,
      latitude: booking.address.latitude,
      longitude: booking.address.longitude,
      instructions: booking.address.instructions,
    },
    serviceArea: booking.serviceArea,

    pricing: {
      subtotal: booking.subtotal,
      serviceFee: booking.serviceFee,
      discount: booking.discount,
      total: booking.totalAmount,
      currency: booking.currency,
      formatted: {
        subtotal: formatMoney(booking.subtotal, booking.currency),
        serviceFee: formatMoney(booking.serviceFee, booking.currency),
        total: formatMoney(booking.totalAmount, booking.currency),
      },
    },

    waste: booking.wasteBooking
      ? {
          wasteTypes: booking.wasteBooking.wasteTypes,
          collectionSize: booking.wasteBooking.collectionSize,
          estimatedQuantity: booking.wasteBooking.estimatedQuantity,
          specialInstructions: booking.wasteBooking.specialInstructions,
        }
      : null,

    cleaning: booking.cleaningBooking
      ? {
          cleaningType: booking.cleaningBooking.cleaningType,
          propertyType: booking.cleaningBooking.propertyType,
          propertySize: booking.cleaningBooking.propertySize,
          numberOfRooms: booking.cleaningBooking.numberOfRooms,
          specialInstructions: booking.cleaningBooking.specialInstructions,
        }
      : null,

    // The customer sees who is coming, never internal ids beyond what tracking
    // needs (ui.md §23).
    assignment: assignment
      ? {
          id: assignment.id,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          acceptedAt: assignment.acceptedAt,
          driver: driverUser
            ? {
                ...toUserSummary(driverUser),
                currentLatitude: assignment.driver?.currentLatitude ?? null,
                currentLongitude: assignment.driver?.currentLongitude ?? null,
              }
            : null,
          cleaner: assignment.cleaner ? toUserSummary(assignment.cleaner) : null,
          truck: assignment.truck,
        }
      : null,

    payment: booking.payments[0] ?? null,

    notes: booking.notes,
    subscriptionId: booking.subscriptionId,
    cancelledAt: booking.cancelledAt,
    cancellationReason: booking.cancellationReason,
    completedAt: booking.completedAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
};

export type BookingView = ReturnType<typeof toBookingView>;
