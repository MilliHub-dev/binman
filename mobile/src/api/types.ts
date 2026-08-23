/**
 * Wire types mirroring the BinMan API.
 *
 * These are hand-written rather than generated because the API is small and
 * stable; if it starts drifting, generate them from the OpenAPI spec instead of
 * patching by hand.
 *
 * Every amount is an integer in KOBO.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PageMeta;
  error?: { code: string; details?: unknown; requestId?: string };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export type ServiceType = 'WASTE_COLLECTION' | 'CLEANING';

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'DRIVER_EN_ROUTE'
  | 'ARRIVED'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export type WasteType =
  | 'HOUSEHOLD'
  | 'FOOD'
  | 'PLASTIC'
  | 'PAPER'
  | 'CARDBOARD'
  | 'MIXED'
  | 'GARDEN'
  | 'COMMERCIAL'
  | 'OTHER';

export type CollectionSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE' | 'CUSTOM';

export type CleaningType = 'REGULAR' | 'DEEP' | 'OFFICE' | 'MOVE_IN' | 'MOVE_OUT' | 'POST_EVENT';
export type PropertyType = 'APARTMENT' | 'HOUSE' | 'OFFICE' | 'SHOP' | 'OTHER';
export type PropertySize =
  | 'ONE_BEDROOM'
  | 'TWO_BEDROOM'
  | 'THREE_BEDROOM'
  | 'FOUR_PLUS_BEDROOM'
  | 'CUSTOM';

export type SubscriptionFrequency = 'WEEKLY' | 'TWICE_WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';

export interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  profileImage: string | null;
  profileComplete: boolean;
  notificationPreferences: {
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    email: boolean;
  };
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: User;
  profileComplete: boolean;
}

export interface RequestOtpResult {
  expiresAt: string;
  isNewUser: boolean;
  /** Development only — the server omits this outside dev. */
  debugCode?: string;
}

export interface Address {
  id: string;
  label: string;
  addressLine: string;
  area: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  instructions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isDefault: boolean;
  /** False when we do not yet collect at this location. */
  serviceable: boolean;
}

export interface TimeSlot {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  window: string;
  maxBookings: number;
  booked: number;
  remaining: number;
  available: boolean;
  unavailableReason: 'FULL' | 'PAST' | null;
}

export interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

export interface Quote {
  subtotal: number;
  serviceFee: number;
  discount: number;
  total: number;
  currency: string;
  pricingRuleId: string | null;
  serviceAreaId: string | null;
  breakdown: Array<{ label: string; amount: number }>;
  formatted: { subtotal: string; serviceFee: string; total: string };
}

export interface PriceListItem {
  id: string;
  serviceType: ServiceType;
  wasteType: WasteType | null;
  collectionSize: CollectionSize | null;
  cleaningType: CleaningType | null;
  propertySize: PropertySize | null;
  basePrice: number;
  serviceFee: number;
  currency: string;
  formatted: string;
}

export interface BookingAssignment {
  id: string;
  status: string;
  assignedAt: string;
  acceptedAt: string | null;
  driver: {
    id: string;
    fullName: string | null;
    phone: string;
    currentLatitude: number | null;
    currentLongitude: number | null;
  } | null;
  cleaner: { id: string; fullName: string | null; phone: string } | null;
  truck: {
    id: string;
    truckNumber: string;
    registrationNumber: string;
    truckType: string;
  } | null;
}

export interface Booking {
  id: string;
  reference: string;
  serviceType: ServiceType;
  status: BookingStatus;
  statusLabel: string;
  paymentStatus: PaymentStatus;
  scheduledDate: string;
  timeSlot: {
    id: string;
    label: string;
    window: string;
    startTime: number;
    endTime: number;
  };
  address: {
    id: string;
    label: string;
    addressLine: string;
    area: string;
    city: string;
    state: string;
    latitude: number | null;
    longitude: number | null;
    instructions: string | null;
  };
  pricing: {
    subtotal: number;
    serviceFee: number;
    discount: number;
    total: number;
    currency: string;
    formatted: { subtotal: string; serviceFee: string; total: string };
  };
  waste: {
    wasteTypes: WasteType[];
    collectionSize: CollectionSize;
    estimatedQuantity: string | null;
    specialInstructions: string | null;
  } | null;
  cleaning: {
    cleaningType: CleaningType;
    propertyType: PropertyType;
    propertySize: PropertySize;
    numberOfRooms: number | null;
    specialInstructions: string | null;
  } | null;
  assignment: BookingAssignment | null;
  payment: {
    id: string;
    reference: string;
    status: PaymentStatus;
    amount: number;
    checkoutUrl: string | null;
    paidAt: string | null;
  } | null;
  notes: string | null;
  subscriptionId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  oldStatus: BookingStatus | null;
  newStatus: BookingStatus;
  reason: string | null;
  createdAt: string;
}

export interface PaymentInit {
  reference: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  formattedAmount: string;
}

export interface PaymentStatusResult {
  reference: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  formattedAmount: string;
  paidAt: string | null;
  channel: string | null;
  booking: { id: string; reference: string; status: BookingStatus; paymentStatus: PaymentStatus } | null;
}

export interface Subscription {
  id: string;
  serviceType: ServiceType;
  frequency: SubscriptionFrequency;
  daysOfWeek: number[];
  amount: number;
  currency: string;
  amountFormatted: string;
  status: SubscriptionStatus;
  nextRunDate: string | null;
  nextRunDateFormatted: string | null;
  wasteTypes: WasteType[];
  collectionSize: CollectionSize | null;
  address: Address;
  timeSlot: { id: string; label: string; startTime: number; endTime: number };
}

export interface Notification {
  id: string;
  channel: string;
  type: string;
  title: string;
  message: string;
  status: string;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface TicketMessage {
  id: string;
  fromStaff: boolean;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
  booking: { id: string; reference: string } | null;
}

export interface Review {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface GeoResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  accuracy: string | null;
  /** Structured parts — see the note in the server's maps.service. */
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  coverage?: { serviceable: boolean | null; areaName: string | null };
}

export interface ServiceArea {
  id: string;
  name: string;
  city: string;
  state: string;
  isActive: boolean;
}
