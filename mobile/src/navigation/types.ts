import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Route params, typed end to end. `useNavigation<...>()` picks these up, so a
 * renamed route or a missing param is a compile error rather than a runtime
 * "undefined is not an object".
 */

export type AuthStackParamList = {
  /** Registered here as well as in Profile: the sign-in screen links to them
   *  before anyone has an account. */
  Terms: undefined;
  Privacy: undefined;
  Onboarding: undefined;
  Phone: undefined;
  Otp: { phone: string; isNewUser: boolean; debugCode?: string };
  ProfileSetup: undefined;
};

export type BookingStackParamList = {
  SelectAddress: { serviceType: 'WASTE_COLLECTION' | 'CLEANING' };
  AddAddress: { returnTo?: 'SelectAddress' } | undefined;
  WasteType: undefined;
  WasteSize: undefined;
  CleaningType: undefined;
  CleaningProperty: undefined;
  DateTime: undefined;
  Review: undefined;
  Payment: { bookingId: string };
  Confirmation: { bookingId: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  PersonalInfo: undefined;
  Addresses: undefined;
  AddAddress: { addressId?: string } | undefined;
  Subscriptions: undefined;
  CreateSubscription: undefined;
  NotificationSettings: undefined;
  Support: undefined;
  NewTicket: undefined;
  Terms: undefined;
  Privacy: undefined;
};

export type TabParamList = {
  Home: undefined;
  /**
   * Action tabs, not destinations: their `tabPress` is intercepted and opens
   * the booking flow. They still need a registered screen because the tab bar
   * renders from the navigator's screen list.
   */
  Pickup: undefined;
  Cleaning: undefined;
  Bookings: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Tabs: NavigatorScreenParams<TabParamList>;
  Booking: NavigatorScreenParams<BookingStackParamList>;
  BookingDetail: { bookingId: string };
  TrackPickup: { bookingId: string };
  RateService: { bookingId: string };
  Notifications: undefined;
  /** Browse-everything page. Left the tab bar when Pickup and Cleaning took
   *  its place there, and is now pushed from Home and from Profile. */
  Services: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
