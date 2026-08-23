import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import * as endpoints from './endpoints';
import type { Booking, DayAvailability, TimeSlot } from './types';
import { ApiError } from './client';

/**
 * Query keys are centralised so an invalidation can never miss a cache entry
 * because two call sites spelled the key differently.
 */
export const keys = {
  me: ['me'] as const,
  addresses: ['addresses'] as const,
  serviceAreas: ['service-areas'] as const,
  timeSlots: ['time-slots'] as const,
  availability: (date: string, days: number) => ['availability', date, days] as const,
  priceList: ['price-list'] as const,
  quote: (input: unknown) => ['quote', input] as const,
  bookings: (scope: string) => ['bookings', scope] as const,
  booking: (id: string) => ['booking', id] as const,
  timeline: (id: string) => ['booking', id, 'timeline'] as const,
  payment: (reference: string) => ['payment', reference] as const,
  subscriptions: ['subscriptions'] as const,
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  tickets: ['support', 'tickets'] as const,
};

/** A booking whose status can still change needs fresher data than history. */
const isLive = (booking?: Booking): boolean =>
  booking !== undefined &&
  ['PAID', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'COLLECTED'].includes(
    booking.status,
  );

// --- Reads ------------------------------------------------------------------

export const useAddresses = () =>
  useQuery({ queryKey: keys.addresses, queryFn: endpoints.listAddresses });

export const useTimeSlots = () =>
  useQuery({ queryKey: keys.timeSlots, queryFn: endpoints.listTimeSlots, staleTime: 10 * 60_000 });

export const useAvailability = (date: string, days = 1, enabled = true) =>
  useQuery({
    queryKey: keys.availability(date, days),
    queryFn: () => endpoints.getAvailability(date, days),
    enabled: enabled && Boolean(date),
    // Slots fill up while the customer is deciding — do not serve stale
    // availability that lets them pick a place that has already gone.
    staleTime: 30_000,
  });

export const usePriceList = () =>
  useQuery({ queryKey: keys.priceList, queryFn: endpoints.getPriceList, staleTime: 10 * 60_000 });

export const useBookings = (scope: endpoints.BookingScope) =>
  useQuery({ queryKey: keys.bookings(scope), queryFn: () => endpoints.listBookings(scope) });

export const useBooking = (
  id: string,
  options?: Partial<UseQueryOptions<Booking, ApiError>>,
) =>
  useQuery<Booking, ApiError>({
    queryKey: keys.booking(id),
    queryFn: () => endpoints.getBooking(id),
    enabled: Boolean(id),
    // While a job is under way the customer is watching this screen; poll so
    // "Driver en route" appears without them pulling to refresh.
    refetchInterval: (query) => (isLive(query.state.data) ? 20_000 : false),
    ...options,
  });

export const useBookingTimeline = (id: string) =>
  useQuery({
    queryKey: keys.timeline(id),
    queryFn: () => endpoints.getBookingTimeline(id),
    enabled: Boolean(id),
  });

export const useSubscriptions = () =>
  useQuery({ queryKey: keys.subscriptions, queryFn: endpoints.listSubscriptions });

export const useNotifications = () =>
  useQuery({ queryKey: keys.notifications, queryFn: () => endpoints.listNotifications() });

export const useUnreadCount = () =>
  useQuery({
    queryKey: keys.unreadCount,
    queryFn: endpoints.getUnreadCount,
    refetchInterval: 60_000,
  });

export const useTickets = () =>
  useQuery({ queryKey: keys.tickets, queryFn: endpoints.listTickets });

// --- Writes -----------------------------------------------------------------

/** Anything that changes a booking invalidates every list it could appear in. */
const useInvalidateBookings = () => {
  const client = useQueryClient();
  return (bookingId?: string) => {
    void client.invalidateQueries({ queryKey: ['bookings'] });
    if (bookingId) void client.invalidateQueries({ queryKey: keys.booking(bookingId) });
  };
};

export const useCreateAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.createAddress,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.addresses }),
  });
};

export const useUpdateAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<endpoints.AddressInput> }) =>
      endpoints.updateAddress(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.addresses }),
  });
};

export const useDeleteAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.deleteAddress,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.addresses }),
  });
};

export const useSetDefaultAddress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.setDefaultAddress,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.addresses }),
  });
};

export const useCreateBooking = () => {
  const invalidate = useInvalidateBookings();
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.createBooking,
    onSuccess: (booking) => {
      invalidate(booking.id);
      // A new booking consumes slot capacity, so cached availability is wrong.
      void client.invalidateQueries({ queryKey: ['availability'] });
    },
  });
};

export const useCancelBooking = () => {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      endpoints.cancelBooking(id, reason),
    onSuccess: (result) => invalidate(result.booking.id),
  });
};

export const useInitiatePayment = () =>
  useMutation({ mutationFn: endpoints.initiatePayment });

export const useCreateSubscription = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.createSubscription,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.subscriptions }),
  });
};

export const useUpdateSubscription = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { status?: 'ACTIVE' | 'PAUSED'; daysOfWeek?: number[] };
    }) => endpoints.updateSubscription(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.subscriptions }),
  });
};

export const useCancelSubscription = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.cancelSubscription,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.subscriptions }),
  });
};

export const useCreateReview = () => {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: endpoints.createReview,
    onSuccess: (review) => invalidate(review.bookingId),
  });
};

export const useMarkAllRead = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.markAllNotificationsRead,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.notifications });
      void client.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
};

export const useTicketMessages = (ticketId: string | null) =>
  useQuery({
    queryKey: ['ticket-messages', ticketId],
    queryFn: () => endpoints.listTicketMessages(ticketId!),
    enabled: Boolean(ticketId),
  });

export const useReplyToTicket = (ticketId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => endpoints.replyToTicket(ticketId, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
      // Replying to a resolved ticket reopens it, so the list changes too.
      void client.invalidateQueries({ queryKey: keys.tickets });
    },
  });
};

export const useCreateTicket = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endpoints.createTicket,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.tickets }),
  });
};

/** Narrows the availability response, which differs by `days`. */
export const asDayList = (data: DayAvailability[] | TimeSlot[] | undefined): DayAvailability[] =>
  Array.isArray(data) && data.length > 0 && 'date' in data[0]! ? (data as DayAvailability[]) : [];

export const asSlotList = (data: DayAvailability[] | TimeSlot[] | undefined): TimeSlot[] =>
  Array.isArray(data) && (data.length === 0 || 'id' in data[0]!) ? (data as TimeSlot[]) : [];
