import { api, qs, type PageMeta } from './api';

/**
 * Typed wrappers over the 37 admin endpoints in
 * server/src/modules/admin/admin.routes.ts. No logic beyond shaping requests.
 *
 * MONEY is always an integer in kobo.
 */

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

export interface Dashboard {
  date: string;
  customers: { total: number };
  bookings: {
    today: number;
    pending: number;
    completed: number;
    failed: number;
    cleaning: number;
    awaitingDispatch: number;
  };
  fleet: { activeDrivers: number; activeTrucks: number };
  revenue: { today: number; month: number; formatted: { today: string; month: string } };
}

export interface LiveOperations {
  date: string;
  statuses: Array<{ status: BookingStatus; count: number }>;
}

export interface AdminBooking {
  id: string;
  reference: string;
  serviceType: 'WASTE_COLLECTION' | 'CLEANING';
  status: BookingStatus;
  statusLabel: string;
  paymentStatus: PaymentStatus;
  scheduledDate: string;
  timeSlot: { id: string; label: string; window: string; startTime: number };
  address: { area: string; city: string; addressLine: string };
  pricing: { total: number; currency: string; formatted: { total: string } };
  waste: { wasteTypes: string[]; collectionSize: string } | null;
  assignment: {
    id: string;
    status: string;
    driver: { id: string; fullName: string | null; phone: string } | null;
    truck: { id: string; truckNumber: string } | null;
  } | null;
  customer: { id: string; name: string | null; phone: string };
  createdAt: string;
}

export interface DispatchBoard {
  date: string;
  unassigned: Array<{
    id: string;
    reference: string;
    serviceType: string;
    status: BookingStatus;
    customer: string;
    phone: string;
    area: string;
    addressLine: string;
    window: string;
    collectionSize: string | null;
    wasteTypes: string[];
    paymentStatus: PaymentStatus;
    totalAmount: number;
  }>;
  drivers: Array<{
    id: string;
    name: string | null;
    phone: string;
    status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'SUSPENDED';
    jobsToday: number;
    defaultTruck: { id: string; truckNumber: string; status: string } | null;
    verificationStatus: string;
  }>;
  trucks: Array<{
    id: string;
    truckNumber: string;
    registrationNumber: string;
    truckType: string;
    status: 'AVAILABLE' | 'ASSIGNED' | 'ON_ROUTE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  }>;
}

export interface AdminCustomer {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  status: string;
  createdAt: string;
  counts: { bookings: number; addresses: number; subscriptions: number };
}

export interface Driver {
  id: string;
  licenseNumber: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'SUSPENDED';
  user: { id: string; firstName: string | null; lastName: string | null; phone: string; status: string };
  defaultTruck: { id: string; truckNumber: string } | null;
}

export interface Truck {
  id: string;
  truckNumber: string;
  registrationNumber: string;
  truckType: string;
  capacity: string | null;
  status: 'AVAILABLE' | 'ASSIGNED' | 'ON_ROUTE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  nextServiceDue: string | null;
}

export interface PricingRule {
  id: string;
  serviceType: 'WASTE_COLLECTION' | 'CLEANING';
  wasteType: string | null;
  collectionSize: string | null;
  cleaningType: string | null;
  propertySize: string | null;
  serviceAreaId: string | null;
  basePrice: number;
  serviceFee: number;
  currency: string;
  isActive: boolean;
}

export interface ServiceArea {
  id: string;
  name: string;
  city: string;
  state: string;
  isActive: boolean;
  surcharge: number;
  waitlist: boolean;
}

export interface TimeSlot {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  maxBookings: number;
  isActive: boolean;
  sortOrder: number;
}

export interface RevenueReport {
  range: { from: string; to: string };
  totalRevenue: number;
  totalRevenueFormatted: string;
  transactionCount: number;
  averageTransaction: number;
  averageTransactionFormatted: string;
  byService: Array<{ serviceType: string; revenue: number; revenueFormatted: string; bookings: number }>;
}

export interface BookingsReport {
  range: { from: string; to: string };
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  completionRate: number;
  byStatus: Array<{ status: BookingStatus; count: number }>;
  byService: Array<{ serviceType: string; count: number }>;
  byArea: Array<{ serviceAreaId: string | null; name: string; count: number }>;
}

export interface DriverReport {
  range: { from: string; to: string };
  drivers: Array<{
    driverId: string;
    name: string | null;
    phone: string;
    totalJobs: number;
    completed: number;
    failed: number;
    completionRate: number;
  }>;
}

// --- Auth -------------------------------------------------------------------

export interface StaffSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; fullName: string | null; role: string; phone: string; email: string | null };
  /** True while the account is still on a seeded or reset password. */
  mustChangePassword: boolean;
}

/** Staff sign in with email and password; only OTP is used by customers. */
export const login = (email: string, password: string) =>
  api.post<StaffSession>('/auth/login', { email, password }, { skipAuth: true });

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post<null>('/auth/change-password', { currentPassword, newPassword });

export const me = () =>
  api.get<{ id: string; fullName: string | null; phone: string; role: string }>('/users/me');

/** Roles allowed past the login gate. */
export const STAFF_ROLES = ['SUPPORT', 'DISPATCHER', 'ADMIN', 'SUPER_ADMIN'];

// --- Dashboard --------------------------------------------------------------

export const getDashboard = () => api.get<Dashboard>('/admin/dashboard');
export const getLiveOperations = () => api.get<LiveOperations>('/admin/operations/live');

// --- Bookings ---------------------------------------------------------------

export interface BookingFilters {
  page?: number;
  status?: string;
  serviceType?: string;
  paymentStatus?: string;
  driverId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export const listBookings = (filters: BookingFilters = {}) =>
  api.list<AdminBooking[]>(`/admin/bookings${qs({ limit: 20, ...filters })}`);

export const getBooking = (id: string) => api.get<AdminBooking & Record<string, unknown>>(`/admin/bookings/${id}`);

export const changeBookingStatus = (id: string, status: BookingStatus, reason?: string) =>
  api.patch(`/admin/bookings/${id}/status`, { status, ...(reason ? { reason } : {}) });

export const cancelBooking = (id: string, reason: string) =>
  api.post(`/admin/bookings/${id}/cancel`, { reason });

// --- Dispatch ---------------------------------------------------------------

export const getDispatchBoard = (date?: string) =>
  api.get<DispatchBoard>(`/admin/dispatch${qs({ date })}`);

export const assignBooking = (
  bookingId: string,
  input: { driverId?: string; truckId?: string; cleanerId?: string },
) => api.post(`/admin/bookings/${bookingId}/assign`, input);

export const unassignBooking = (bookingId: string, reason?: string) =>
  api.post(`/admin/bookings/${bookingId}/unassign`, { reason });

// --- Customers --------------------------------------------------------------

export const listCustomers = (params: { page?: number; search?: string; status?: string } = {}) =>
  api.list<AdminCustomer[]>(`/admin/customers${qs({ limit: 20, ...params })}`);

/** The full record the customer drawer renders (server: customers.service.ts). */
export interface CustomerDetail {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  status: string;
  createdAt: string;
  lifetimeValue: number;
  lifetimeValueFormatted: string;
  successfulPayments: number;
  addresses: Array<{ id: string; label: string; addressLine: string; area: string; city: string }>;
  recentBookings: Array<{
    id: string;
    reference: string;
    serviceType: string;
    status: BookingStatus;
    scheduledDate: string;
    totalAmount: number;
    paymentStatus: PaymentStatus;
  }>;
  subscriptions: unknown[];
  recentPayments: unknown[];
  supportTickets: unknown[];
}

export const getCustomer = (id: string) => api.get<CustomerDetail>(`/admin/customers/${id}`);

export const setCustomerStatus = (id: string, status: 'ACTIVE' | 'SUSPENDED') =>
  api.patch(`/admin/customers/${id}/status`, { status });

// --- Fleet ------------------------------------------------------------------

export const listDrivers = (params: { page?: number; search?: string; status?: string } = {}) =>
  api.list<Driver[]>(`/admin/drivers${qs({ limit: 50, ...params })}`);

export const createDriver = (input: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  licenseNumber?: string;
}) => api.post<Driver>('/admin/drivers', input);

export const updateDriver = (id: string, input: Record<string, unknown>) =>
  api.patch<Driver>(`/admin/drivers/${id}`, input);

export const suspendDriver = (id: string) => api.post(`/admin/drivers/${id}/suspend`);

export const listTrucks = (params: { page?: number; search?: string; status?: string } = {}) =>
  api.list<Truck[]>(`/admin/trucks${qs({ limit: 50, ...params })}`);

export const createTruck = (input: {
  truckNumber: string;
  registrationNumber: string;
  truckType: string;
  capacity?: string;
}) => api.post<Truck>('/admin/trucks', input);

export const updateTruck = (id: string, input: Record<string, unknown>) =>
  api.patch<Truck>(`/admin/trucks/${id}`, input);

// --- Configuration ----------------------------------------------------------

export const listPricingRules = () => api.get<PricingRule[]>('/admin/pricing');

export const createPricingRule = (input: Record<string, unknown>) =>
  api.post<PricingRule>('/admin/pricing', input);

export const updatePricingRule = (id: string, input: Record<string, unknown>) =>
  api.patch<PricingRule>(`/admin/pricing/${id}`, input);

export const listServiceAreas = () => api.get<ServiceArea[]>('/admin/service-areas');

export const createServiceArea = (input: {
  name: string;
  city: string;
  state: string;
  surcharge?: number;
}) => api.post<ServiceArea>('/admin/service-areas', input);

export const updateServiceArea = (id: string, input: Record<string, unknown>) =>
  api.patch<ServiceArea>(`/admin/service-areas/${id}`, input);

export const listTimeSlots = () => api.get<TimeSlot[]>('/admin/time-slots');

export const updateTimeSlot = (id: string, input: Record<string, unknown>) =>
  api.patch<TimeSlot>(`/admin/time-slots/${id}`, input);

// --- Reports ----------------------------------------------------------------

export const revenueReport = (from: string, to: string) =>
  api.get<RevenueReport>(`/admin/reports/revenue${qs({ from, to })}`);

export const bookingsReport = (from: string, to: string) =>
  api.get<BookingsReport>(`/admin/reports/bookings${qs({ from, to })}`);

export const driverReport = (from: string, to: string) =>
  api.get<DriverReport>(`/admin/reports/drivers${qs({ from, to })}`);

/** CSV export is a file download, so it bypasses the JSON envelope. */
export const exportBookingsUrl = (from: string, to: string) =>
  `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/admin/reports/export/bookings${qs(
    { from, to, format: 'csv' },
  )}`;

export type { PageMeta };
