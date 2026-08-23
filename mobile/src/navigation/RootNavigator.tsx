import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '../components';
import { useTheme, useStyles, spacing, radius, typography, type Colors } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useBookingDraft } from '../store/bookingDraft';
import type {
  AuthStackParamList,
  BookingStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  TabParamList,
} from './types';

import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { PhoneScreen } from '../screens/auth/PhoneScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { ProfileSetupScreen } from '../screens/auth/ProfileSetupScreen';

import { HomeScreen } from '../screens/home/HomeScreen';
import { ServicesScreen } from '../screens/home/ServicesScreen';
import { NotificationsScreen } from '../screens/home/NotificationsScreen';

import { BookingsScreen } from '../screens/bookings/BookingsScreen';
import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';
import { TrackPickupScreen } from '../screens/bookings/TrackPickupScreen';
import { RateServiceScreen } from '../screens/bookings/RateServiceScreen';

import { SelectAddressScreen } from '../screens/booking/SelectAddressScreen';
import { AddAddressScreen } from '../screens/booking/AddAddressScreen';
import { WasteTypeScreen } from '../screens/booking/WasteTypeScreen';
import { WasteSizeScreen } from '../screens/booking/WasteSizeScreen';
import { CleaningTypeScreen } from '../screens/booking/CleaningTypeScreen';
import { CleaningPropertyScreen } from '../screens/booking/CleaningPropertyScreen';
import { DateTimeScreen } from '../screens/booking/DateTimeScreen';
import { ReviewScreen } from '../screens/booking/ReviewScreen';
import { PaymentScreen } from '../screens/booking/PaymentScreen';
import { ConfirmationScreen } from '../screens/booking/ConfirmationScreen';

import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { PersonalInfoScreen } from '../screens/profile/PersonalInfoScreen';
import { AddressesScreen } from '../screens/profile/AddressesScreen';
import { SubscriptionsScreen } from '../screens/profile/SubscriptionsScreen';
import { CreateSubscriptionScreen } from '../screens/profile/CreateSubscriptionScreen';
import { NotificationSettingsScreen } from '../screens/profile/NotificationSettingsScreen';
import { SupportScreen } from '../screens/profile/SupportScreen';
import { TermsScreen } from '../screens/legal/TermsScreen';
import { PrivacyScreen } from '../screens/legal/PrivacyScreen';

void SplashScreen.preventAutoHideAsync();

/**
 * Navigation draws its own chrome — header bars, screen backgrounds, the
 * default card colour behind a transition — so it needs the palette too. Left
 * static, every screen would sit on a white sheet in dark mode for the frame
 * before its own background painted.
 */
const useNavTheme = () => {
  const { colors, isDark } = useTheme();
  return React.useMemo(
    () => ({
      ...DefaultTheme,
      dark: isDark,
      colors: {
        ...DefaultTheme.colors,
        primary: colors.brand,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    }),
    [colors, isDark],
  );
};

const useStackOptions = () => {
  const { colors } = useTheme();
  return React.useMemo(
    () =>
      ({
        headerShown: true,
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: typography.h3,
        contentStyle: { backgroundColor: colors.background },
      }) as const,
    [colors],
  );
};

// --- Auth -------------------------------------------------------------------

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = () => {
  const stackOptions = useStackOptions();
  return (
  <AuthStack.Navigator screenOptions={{ ...stackOptions, headerShown: false }}>
    <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
    {/*
      No header: the empty bar existed only to carry a back arrow, and the
      screen paints its own background to the top edge. Onboarding is still
      reachable by the Android hardware back button.
    */}
    <AuthStack.Screen name="Phone" component={PhoneScreen} />
    {/*
      Also headerless: the screen paints its own background to the top edge, and
      a solid header bar would clip it with a flat band. "Wrong number? Change
      it" is the way back, alongside the Android hardware button.
    */}
    <AuthStack.Screen name="Otp" component={OtpScreen} />
    <AuthStack.Screen name="Terms" component={TermsScreen} options={{ headerShown: true, title: 'Terms' }} />
    <AuthStack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: true, title: 'Privacy' }} />
  </AuthStack.Navigator>
  );
};

// --- Booking flow -----------------------------------------------------------

const BookingStack = createNativeStackNavigator<BookingStackParamList>();

const BookingNavigator = () => {
  const stackOptions = useStackOptions();
  return (
  <BookingStack.Navigator screenOptions={stackOptions}>
    <BookingStack.Screen name="SelectAddress" component={SelectAddressScreen} options={{ title: 'Pickup address' }} />
    <BookingStack.Screen name="AddAddress" component={AddAddressScreen} options={{ title: 'New address' }} />
    <BookingStack.Screen name="WasteType" component={WasteTypeScreen} options={{ title: 'Waste type' }} />
    <BookingStack.Screen name="WasteSize" component={WasteSizeScreen} options={{ title: 'Quantity' }} />
    <BookingStack.Screen name="CleaningType" component={CleaningTypeScreen} options={{ title: 'Cleaning' }} />
    <BookingStack.Screen name="CleaningProperty" component={CleaningPropertyScreen} options={{ title: 'Property' }} />
    <BookingStack.Screen name="DateTime" component={DateTimeScreen} options={{ title: 'Date & time' }} />
    <BookingStack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review' }} />
    <BookingStack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
    <BookingStack.Screen
      name="Confirmation"
      component={ConfirmationScreen}
      // No way back into a completed payment flow.
      options={{ headerShown: false, gestureEnabled: false }}
    />
  </BookingStack.Navigator>
  );
};

// --- Profile ----------------------------------------------------------------

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const ProfileNavigator = () => {
  const stackOptions = useStackOptions();
  return (
  <ProfileStack.Navigator screenOptions={stackOptions}>
    <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
    <ProfileStack.Screen name="PersonalInfo" component={PersonalInfoScreen} options={{ title: 'Personal information' }} />
    <ProfileStack.Screen name="Addresses" component={AddressesScreen} options={{ title: 'My addresses' }} />
    <ProfileStack.Screen name="AddAddress" component={AddAddressScreen} options={{ title: 'Address' }} />
    <ProfileStack.Screen name="Subscriptions" component={SubscriptionsScreen} options={{ title: 'Subscriptions' }} />
    <ProfileStack.Screen name="CreateSubscription" component={CreateSubscriptionScreen} options={{ title: 'Regular collection' }} />
    <ProfileStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notifications' }} />
    <ProfileStack.Screen name="Support" component={SupportScreen} options={{ title: 'Help & support' }} />
    <ProfileStack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms' }} />
    <ProfileStack.Screen name="Privacy" component={PrivacyScreen} options={{ title: 'Privacy' }} />
  </ProfileStack.Navigator>
  );
};

// --- Tabs -------------------------------------------------------------------

const Tab = createBottomTabNavigator<TabParamList>();

const TabIcon: React.FC<{ name: IconName; focused: boolean; color: string }> = ({
  name,
  focused,
  color,
}) => {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.tabIcon}>
      <Icon name={name} size={22} color={color} strokeWidth={focused ? 2.3 : 1.8} />
      {/* The selected tab carries a bar rather than a filled pill: it marks the
          tab without stealing contrast from the icon beside it. */}
      <View style={[styles.tabMark, focused && styles.tabMarkActive]} />
    </View>
  );
};

/**
 * Tabs.
 *
 * Pickup and Cleaning are actions, not destinations — they open the booking
 * flow rather than showing a page. `tabPress` is intercepted so the tab never
 * actually selects; without that the bar would highlight a tab whose screen the
 * customer never sees, and Android's back button would land them on an empty
 * placeholder.
 */
const TabNavigator = () => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const startDraft = useBookingDraft((state) => state.start);

  const openBooking = (
    navigation: { navigate: (screen: string, params?: object) => void },
    serviceType: 'WASTE_COLLECTION' | 'CLEANING',
  ) => {
    startDraft(serviceType);
    navigation.navigate('Booking', { screen: 'SelectAddress', params: { serviceType } });
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: (p) => <TabIcon name="home" focused={p.focused} color={p.color} />,
        }}
      />
      <Tab.Screen
        name="Pickup"
        component={HomeScreen}
        options={{
          title: 'Pickup',
          tabBarIcon: (p) => <TabIcon name="waste" focused={p.focused} color={p.color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            openBooking(navigation, 'WASTE_COLLECTION');
          },
        })}
      />
      <Tab.Screen
        name="Cleaning"
        component={HomeScreen}
        options={{
          title: 'Cleaning',
          tabBarIcon: (p) => <TabIcon name="cleaning" focused={p.focused} color={p.color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            openBooking(navigation, 'CLEANING');
          },
        })}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{
          tabBarIcon: (p) => <TabIcon name="bookings" focused={p.focused} color={p.color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          tabBarIcon: (p) => <TabIcon name="profile" focused={p.focused} color={p.color} />,
        }}
      />
    </Tab.Navigator>
  );
};

// --- Root -------------------------------------------------------------------

const RootStack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const navTheme = useNavTheme();
  const stackOptions = useStackOptions();
  const status = useAuthStore((state) => state.status);
  const needsProfile = useAuthStore((state) => state.needsProfile);
  const restore = useAuthStore((state) => state.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  // The native splash stays up until we know which stack to show, so the app
  // never flashes the sign-in screen at an already-authenticated customer.
  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={stackOptions}>
        {status === 'signedOut' ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} options={{ headerShown: false }} />
        ) : needsProfile ? (
          // Signed in but no name yet — the only way on is to finish the profile.
          <RootStack.Screen
            name="Auth"
            component={ProfileSetupScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <RootStack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
            <RootStack.Screen name="Booking" component={BookingNavigator} options={{ headerShown: false }} />
            <RootStack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking' }} />
            <RootStack.Screen name="TrackPickup" component={TrackPickupScreen} options={{ title: 'Track pickup' }} />
            <RootStack.Screen name="RateService" component={RateServiceScreen} options={{ title: 'Rate your service' }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
            <RootStack.Screen name="Services" component={ServicesScreen} options={{ title: 'Our services' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: c.surface,
      borderTopColor: c.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      // Five tabs need the height back that the old emoji row wasted.
      height: 68,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    tabItem: { paddingTop: 2 },
    tabLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
    tabIcon: { alignItems: 'center', justifyContent: 'center', gap: 4 },
    tabMark: {
      height: 3,
      width: 16,
      borderRadius: radius.pill,
      backgroundColor: 'transparent',
    },
    tabMarkActive: { backgroundColor: c.brand },
  });
