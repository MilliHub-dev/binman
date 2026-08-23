import { api } from './client';
import type {
  Address,
  Booking,
  DayAvailability,
  GeoResult,
  Notification,
  PageMeta,
  PaymentInit,
  PaymentStatusResult,
  PriceListItem,
  Quote,
  Review,
  ServiceArea,
  Subscription,
  SupportTicket,
  TimeSlot,
  TimelineEntry,
  User,
} from './types';

/**
 * Thin, typed wrappers over the API. No logic beyond shaping the request —
 * anything that decides something belongs in a hook or a screen.
 */

// --- Users ------------------------------------------------------------------

export const updateProfile = (input: {
  firstName?: string;
  lastName?: string;
  email?: string | null;
}) => api.patch<User>('/users/me', input);

export const updateNotificationPreferences = (input: {
  push?: boolean;
  sms?: boolean;
  whatsapp?: boolean;
  email?: boolean;
}) => api.patch<User>('/users/me/notification-preferences', input);

export const registerPushToken = (pushToken: string | null) =>
  api.put<null>('/users/me/push-token', { pushToken });

export const uploadAvatar = (uri: string) => {
  const form = new FormData();
  // React Native's FormData accepts this shape for a local file URI.
  form.append('image', {
    uri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  return api.upload<User>('/users/me/avatar', form);
};

// --- Addresses --------------------------------------------------------------

export interface AddressInput {
  label: string;
  addressLine: string;
  area: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  instructions?: string;
  contactName?: string;
  contactPhone?: string;
  isDefault?: boolean;
}

export const listAddresses = () => api.get<Address[]>('/addresses');
export const createAddress = (input: AddressInput) => api.post<Address>('/addresses', input);
export const updateAddress = (id: string, input: Partial<AddressInput>) =>
  api.patch<Address>(`/addresses/${id}`, input);
export const deleteAddress = (id: string) => api.delete<null>(`/addresses/${id}`);
export const setDefaultAddress = (id: string) => api.post<Address>(`/addresses/${id}/default`);

// --- Geo --------------------------------------------------------------------

export const searchAddress = (query: string) =>
  api.get<GeoResult>(`/geo/search?q=${encodeURIComponent(query)}`);

export const reverseGeocode = (latitude: number, longitude: number) =>
  api.get<GeoResult>(`/geo/reverse?latitude=${latitude}&longitude=${longitude}`);

export const listServiceAreas = () => api.get<ServiceArea[]>('/service-areas', { skipAuth: true });

// --- Scheduling & pricing ---------------------------------------------------

export const listTimeSlots = () => api.get<TimeSlot[]>('/time-slots', { skipAuth: true });

/** `days > 1` returns the date strip; otherwise a single day's slots. */
export const getAvailability = (date: string, days = 1) =>
  api.get<DayAvailability[] | TimeSlot[]>(
    `/time-slots/availability?date=${date}&days=${days}`,
    { skipAuth: true },
  );

export const getPriceList = () => api.get<PriceListItem[]>('/pricing', { skipAuth: true });

export interface QuoteInput {
  serviceType: 'WASTE_COLLECTION' | 'CLEANING';
  wasteTypes?: string[];
  collectionSize?: string;
  cleaningType?: string;
  propertySize?: string;
  addressId?: string;
}

export const getQuote = (input: QuoteInput) => api.post<Quote>('/pricing/quote', input);

// --- Bookings ---------------------------------------------------------------

export type BookingScope = 'all' | 'upcoming' | 'active' | 'completed';

export interface CreateBookingInput {
  serviceType: 'WASTE_COLLECTION' | 'CLEANING';
  addressId: string;
  scheduledDate: string;
  timeSlotId: string;
  notes?: string;
  wasteTypes?: string[];
  collectionSize?: string;
  estimatedQuantity?: string;
  cleaningType?: string;
  propertyType?: string;
  propertySize?: string;
  numberOfRooms?: number;
  specialInstructions?: string;
}

export const createBooking = (input: CreateBookingInput) => api.post<Booking>('/bookings', input);

export const listBookings = (scope: BookingScope = 'all', page = 1) =>
  api.get<Booking[]>(`/bookings?scope=${scope}&page=${page}&limit=20`);

export const getBooking = (id: string) => api.get<Booking>(`/bookings/${id}`);

export const getBookingTimeline = (id: string) =>
  api.get<TimelineEntry[]>(`/bookings/${id}/timeline`);

export const cancelBooking = (id: string, reason?: string) =>
  api.post<{ booking: Booking; refundEligible: boolean }>(`/bookings/${id}/cancel`, { reason });

export const rescheduleBooking = (id: string, scheduledDate: string, timeSlotId: string) =>
  api.post<Booking>(`/bookings/${id}/reschedule`, { scheduledDate, timeSlotId });

// --- Payments ---------------------------------------------------------------

export const initiatePayment = (bookingId: string) =>
  api.post<PaymentInit>('/payments/initiate', { bookingId });

/** Polled after the customer returns from checkout; re-verifies with Flutterwave. */
export const checkPayment = (reference: string) =>
  api.get<PaymentStatusResult>(`/payments/${reference}`);

// --- Subscriptions ----------------------------------------------------------

export interface SubscriptionInput {
  serviceType: 'WASTE_COLLECTION' | 'CLEANING';
  frequency: string;
  daysOfWeek: number[];
  timeSlotId: string;
  addressId: string;
  wasteTypes?: string[];
  collectionSize?: string;
  startDate?: string;
}

export const listSubscriptions = () => api.get<Subscription[]>('/subscriptions');
export const createSubscription = (input: SubscriptionInput) =>
  api.post<Subscription>('/subscriptions', input);
export const updateSubscription = (
  id: string,
  input: { status?: 'ACTIVE' | 'PAUSED'; daysOfWeek?: number[]; timeSlotId?: string; addressId?: string },
) => api.patch<Subscription>(`/subscriptions/${id}`, input);
export const cancelSubscription = (id: string) =>
  api.post<Subscription>(`/subscriptions/${id}/cancel`);

// --- Notifications ----------------------------------------------------------

export const listNotifications = (page = 1) =>
  api.get<Notification[]>(`/notifications?page=${page}&limit=30`);
export const getUnreadCount = () => api.get<{ count: number }>('/notifications/unread-count');
export const markNotificationRead = (id: string) => api.post<null>(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post<{ updated: number }>('/notifications/read-all');

// --- Reviews & support ------------------------------------------------------

export const createReview = (input: { bookingId: string; rating: number; comment?: string }) =>
  api.post<Review>('/reviews', input);

export const listReviews = () => api.get<Review[]>('/reviews');

export const createTicket = (input: { subject: string; description: string; bookingId?: string }) =>
  api.post<SupportTicket>('/support/tickets', input);

export const listTickets = () => api.get<SupportTicket[]>('/support/tickets');

export type { PageMeta };
