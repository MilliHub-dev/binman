import { api } from './api';

/** Types mirroring the driver endpoints in server/src/modules/driver. */

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

export type AssignmentStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REASSIGNED'
  | 'CANCELLED';

export interface Job {
  assignmentId: string;
  assignmentStatus: AssignmentStatus;
  acceptedAt: string | null;
  booking: {
    id: string;
    reference: string;
    serviceType: 'WASTE_COLLECTION' | 'CLEANING';
    status: BookingStatus;
    scheduledDate: string;
    timeSlot: { label: string; window: string; startTime: number };
    customer: { id: string; fullName: string | null; phone: string };
    address: {
      label: string;
      addressLine: string;
      area: string;
      city: string;
      latitude: number | null;
      longitude: number | null;
      instructions: string | null;
      contactName: string | null;
      contactPhone: string | null;
    };
    waste: {
      wasteTypes: string[];
      collectionSize: string;
      estimatedQuantity: string | null;
      specialInstructions: string | null;
    } | null;
    cleaning: Record<string, unknown> | null;
    notes: string | null;
  };
  truck: { id: string; truckNumber: string; registrationNumber: string } | null;
}

export interface DriverHome {
  availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'SUSPENDED';
  today: { total: number; completed: number; remaining: number };
  activeJob: Job | null;
}

export const FAILURE_REASONS = [
  { value: 'CUSTOMER_UNAVAILABLE', label: 'Customer unavailable' },
  { value: 'WRONG_ADDRESS', label: 'Wrong address' },
  { value: 'ACCESS_PROBLEM', label: 'Could not access property' },
  { value: 'WASTE_UNAVAILABLE', label: 'No waste to collect' },
  { value: 'VEHICLE_ISSUE', label: 'Vehicle problem' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const getHome = () => api.get<DriverHome>('/driver/home');

export const getJobs = (scope: 'today' | 'upcoming' | 'completed' = 'today') =>
  api.get<Job[]>(`/driver/jobs?scope=${scope}`);

export const getJob = (assignmentId: string) => api.get<Job>(`/driver/jobs/${assignmentId}`);

export const setAvailability = (availabilityStatus: 'AVAILABLE' | 'OFFLINE') =>
  api.patch<{ id: string; availabilityStatus: string }>('/driver/availability', {
    availabilityStatus,
  });

export const requestOtp = (phone: string) =>
  api.post<{ expiresAt: string; isNewUser: boolean; debugCode?: string }>(
    '/auth/request-otp',
    { phone },
    { skipAuth: true },
  );

export const verifyOtp = (phone: string, otp: string) =>
  api.post<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; fullName: string | null; role: string; phone: string };
  }>('/auth/verify-otp', { phone, otp }, { skipAuth: true });

/**
 * The field workflow from driver.md §4. Each entry names the button the driver
 * sees and the status it sets — the server's state machine rejects anything
 * out of order, so the UI only ever offers the next legal step.
 */
export const NEXT_ACTION: Record<
  string,
  { label: string; status: 'DRIVER_EN_ROUTE' | 'ARRIVED' | 'COLLECTED' | 'COMPLETED' } | null
> = {
  ASSIGNED: { label: 'Start Route', status: 'DRIVER_EN_ROUTE' },
  DRIVER_EN_ROUTE: { label: "I've Arrived", status: 'ARRIVED' },
  ARRIVED: { label: 'Waste Collected', status: 'COLLECTED' },
  COLLECTED: { label: 'Complete Job', status: 'COMPLETED' },
  COMPLETED: null,
  FAILED: null,
};

/** Best-effort GPS. Never blocks an action — a fix can take 20s indoors. */
export const currentPosition = (): Promise<{ latitude?: number; longitude?: number }> =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve({});

    const timer = setTimeout(() => resolve({}), 4000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve({});
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 30_000 },
    );
  });
