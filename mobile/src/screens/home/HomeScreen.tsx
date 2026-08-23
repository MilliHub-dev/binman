import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Icon, Screen, StatusBadge, Text } from '../../components';
import { radius, shadow, spacing, typography, useLayout, useStyles, type Colors, useTheme } from '../../theme';
import { formatShortDate, formatSlotTime, greeting } from '../../utils/format';
import { useAuthStore } from '../../store/authStore';
import { useBookingDraft } from '../../store/bookingDraft';
import { useAddresses, useBookings, useSubscriptions, useUnreadCount } from '../../api/queries';
import type { Booking } from '../../api/types';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Home (ui.md §12) — the most important screen.
 *
 * Design note. This used to open with a gradient banner carrying an
 * illustration and a button, then two tiles with an emoji apiece. It looked
 * like every other app: the banner said nothing a customer did not already
 * know, and the tiles duplicated an action the banner had just offered.
 *
 * So the screen now leads with the question people actually open it to ask —
 * *when is my waste going?* — and answers it in the largest type on the page.
 * Underneath, a strip of the coming week marks collection days, because bin day
 * is a weekly rhythm and a row of days is the honest shape for it. Ordering and
 * emphasis carry meaning here; nothing is a panel for the sake of symmetry.
 */
export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((state) => state.user);
  const startDraft = useBookingDraft((state) => state.start);
  const { isSmall } = useLayout();

  const addresses = useAddresses();
  const upcoming = useBookings('upcoming');
  const active = useBookings('active');
  const subscriptions = useSubscriptions();
  const unread = useUnreadCount();

  const defaultAddress = addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];
  const liveBooking = active.data?.[0];
  const nextBooking = upcoming.data?.[0];
  const headline = liveBooking ?? nextBooking;

  const activeSubscription = subscriptions.data?.find((s) => s.status === 'ACTIVE');

  const book = (serviceType: 'WASTE_COLLECTION' | 'CLEANING') => {
    startDraft(serviceType);
    navigation.navigate('Booking', { screen: 'SelectAddress', params: { serviceType } });
  };

  const refreshing = upcoming.isRefetching || active.isRefetching;
  const refresh = () => {
    void upcoming.refetch();
    void active.refetch();
    void addresses.refetch();
    void subscriptions.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="caption" tone="muted">
            {greeting()}
          </Text>
          <Text variant="h2" numberOfLines={1}>
            {user?.firstName ?? 'there'}
          </Text>

          {/*
            The address sits directly under the name because it is the one piece
            of context that changes what a booking means. Tapping it goes to the
            address list — people move, and the wrong default is the most
            expensive mistake this screen can let through.
          */}
          <Pressable
            style={styles.locationRow}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Change collection address"
            onPress={() =>
              navigation.navigate('Tabs', {
                screen: 'Profile',
                params: { screen: 'Addresses' },
              })
            }
          >
            <Icon name="pin" size={13} color={colors.brand} />
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.locationText}>
              {defaultAddress
                ? `${defaultAddress.label} · ${defaultAddress.area}`
                : 'Add a collection address'}
            </Text>
            <Icon name="chevron" size={13} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={styles.bell}
        >
          <Icon name="bell" size={22} color={colors.textSecondary} />
          {(unread.data?.count ?? 0) > 0 ? <View style={styles.badge} /> : null}
        </Pressable>
      </View>

      <NextCollection booking={headline} isLive={Boolean(liveBooking)} isSmall={isSmall} />

      <WeekStrip
        collectionDays={activeSubscription?.daysOfWeek ?? []}
        bookings={[...(active.data ?? []), ...(upcoming.data ?? [])]}
      />

      {headline ? (
        <Pressable
          style={styles.detailRow}
          onPress={() =>
            navigation.navigate(liveBooking ? 'TrackPickup' : 'BookingDetail', {
              bookingId: headline.id,
            })
          }
        >
          <Text variant="bodyMedium" tone="brand">
            {liveBooking ? 'Track this pickup' : 'View booking details'}
          </Text>
          <Icon name="chevron" size={18} color={colors.brand} />
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Button label="Book a pickup" onPress={() => book('WASTE_COLLECTION')} />
        {/* Services left the tab bar when Pickup and Cleaning took its place,
            so this is now the way in to the full list and its prices. */}
        <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate('Services')}>
          <Icon name="cleaning" size={16} color={colors.textSecondary} />
          <Text variant="bodyMedium" tone="secondary">
            See all services and prices
          </Text>
          <Icon name="chevron" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ActiveOrders
        active={active.data ?? []}
        upcoming={upcoming.data ?? []}
        onOpen={(booking, isLive) =>
          navigation.navigate(isLive ? 'TrackPickup' : 'BookingDetail', { bookingId: booking.id })
        }
      />

      {/*
        Only shown to customers who do not already have a plan. Advertising a
        subscription to someone who is on one is how an app tells you it is not
        paying attention.
      */}
      {!activeSubscription && !subscriptions.isLoading ? (
        <Pressable
          style={styles.planRow}
          onPress={() =>
            navigation.navigate('Tabs', {
              screen: 'Profile',
              params: { screen: 'CreateSubscription' },
            })
          }
        >
          <Icon name="repeat" size={18} color={colors.accentPressed} />
          <View style={styles.planBody}>
            <Text variant="bodyMedium">Collect weekly, automatically</Text>
            <Text variant="caption" tone="muted">
              Pick your days once and stop booking each time.
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={styles.bottomSpace} />
    </Screen>
  );
};

/**
 * Everything currently in flight, most urgent first.
 *
 * "Active" is shown the way a customer means it, not the way the API splits it:
 * the server's `active` scope is only jobs a driver has been assigned, while an
 * unpaid booking sits in `upcoming` — and an unpaid booking is the one that most
 * needs attention, because nothing happens until it is paid. Both are listed
 * here, with the ones needing action flagged.
 */
const ActiveOrders: React.FC<{
  active: Booking[];
  upcoming: Booking[];
  onOpen: (booking: Booking, isLive: boolean) => void;
}> = ({ active, upcoming, onOpen }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  const liveIds = new Set(active.map((b) => b.id));
  const orders = [...active, ...upcoming.filter((b) => !liveIds.has(b.id))];

  if (orders.length === 0) return null;

  return (
    <View style={styles.orders}>
      <View style={styles.ordersHead}>
        <Text variant="overline" tone="muted">
          Active orders
        </Text>
        <View style={styles.count}>
          <Text variant="caption" style={styles.countText}>
            {orders.length}
          </Text>
        </View>
      </View>

      {orders.map((booking) => {
        const isLive = liveIds.has(booking.id);
        const needsPayment = booking.status === 'PENDING_PAYMENT';

        return (
          <Pressable
            key={booking.id}
            style={styles.order}
            onPress={() => onOpen(booking, isLive)}
            accessibilityRole="button"
            accessibilityLabel={`${booking.statusLabel}, ${booking.reference}`}
          >
            <View style={styles.orderIcon}>
              <Icon
                name={booking.serviceType === 'CLEANING' ? 'cleaning' : 'waste'}
                size={17}
                color={isLive ? colors.accentPressed : colors.brand}
              />
            </View>

            <View style={styles.orderBody}>
              <View style={styles.orderTop}>
                <Text variant="bodyMedium" numberOfLines={1} style={styles.orderRef}>
                  {booking.reference}
                </Text>
                <StatusBadge status={booking.status} label={booking.statusLabel} />
              </View>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {formatShortDate(booking.scheduledDate)} · {booking.timeSlot.window}
              </Text>
              {/* The only state on this screen the customer must act on. */}
              {needsPayment ? (
                <Text variant="caption" tone="brand" style={styles.orderAction}>
                  Payment needed to confirm
                </Text>
              ) : null}
            </View>

            <Icon name="chevron" size={17} color={colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
};

/**
 * The answer to "when is my waste going?", set larger than anything else on the
 * screen because it is the only thing most people open the app to find out.
 */
const NextCollection: React.FC<{
  booking: Booking | undefined;
  isLive: boolean;
  isSmall: boolean;
}> = ({ booking, isLive, isSmall }) => {
  const styles = useStyles(makeStyles);
  if (!booking) {
    return (
      <View style={styles.panel}>
        <Text variant="overline" tone="muted">
          Next collection
        </Text>
        <Text style={[styles.bigLine, isSmall && styles.bigLineSmall]}>Nothing booked</Text>
        <Text tone="secondary" style={styles.panelSub}>
          Book a pickup and we'll come to you.
        </Text>
      </View>
    );
  }

  const date = new Date(booking.scheduledDate);
  const today = new Date();
  const dayDiff = Math.round(
    (new Date(date.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000,
  );
  // "Today" and "Tomorrow" are how people actually hold near dates in mind.
  const dayWord =
    dayDiff === 0
      ? 'Today'
      : dayDiff === 1
        ? 'Tomorrow'
        : date.toLocaleDateString('en-NG', { weekday: 'long' });

  return (
    <View style={[styles.panel, isLive && styles.panelLive]}>
      <View style={styles.panelHead}>
        <Text variant="overline" tone="muted">
          {isLive ? 'Happening now' : 'Next collection'}
        </Text>
        {isLive ? <View style={styles.livePip} /> : null}
      </View>

      <Text style={[styles.bigLine, isSmall && styles.bigLineSmall]}>{dayWord}</Text>

      <Text tone="secondary" style={styles.panelSub}>
        {isLive
          ? booking.statusLabel
          : `${formatSlotTime(booking.timeSlot.startTime)} – ${formatSlotTime(booking.timeSlot.endTime)}`}
      </Text>
    </View>
  );
};

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The coming seven days, with collection days marked.
 *
 * A row of days is the honest shape for a weekly rhythm — it is a real
 * sequence, so the layout is carrying information rather than decorating. Days
 * come from the customer's plan and from anything already booked.
 */
const WeekStrip: React.FC<{ collectionDays: number[]; bookings: Booking[] }> = ({
  collectionDays,
  bookings,
}) => {
  const styles = useStyles(makeStyles);
  const today = new Date();

  // Dates with a booking already on the calendar, as YYYY-MM-DD.
  const bookedDates = new Set(bookings.map((b) => b.scheduledDate.slice(0, 10)));

  /**
   * Built from local calendar parts, not `toISOString()`. Uyo runs at UTC+1, so
   * converting to UTC just after local midnight reports yesterday's date and
   * the strip marks the wrong day.
   */
  const localIso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const iso = localIso(date);
    return {
      iso,
      dayOfWeek: date.getDay(), // 0 = Sunday, matching the server's convention.
      dayOfMonth: date.getDate(),
      isToday: offset === 0,
      isBooked: bookedDates.has(iso),
      isPlanned: collectionDays.includes(date.getDay()),
    };
  });

  return (
    <View style={styles.week}>
      {days.map((day) => {
        const marked = day.isBooked || day.isPlanned;
        return (
          <View key={day.iso} style={styles.weekDay}>
            <Text variant="caption" tone="muted" style={styles.weekInitial}>
              {DAY_INITIALS[day.dayOfWeek]}
            </Text>
            <View
              style={[
                styles.weekDot,
                day.isToday && styles.weekDotToday,
                // A confirmed booking is solid; a planned day is only an outline,
                // because the two are not the same promise.
                day.isPlanned && !day.isBooked && styles.weekDotPlanned,
                day.isBooked && styles.weekDotBooked,
              ]}
            >
              <Text
                style={[
                  styles.weekNumber,
                  day.isBooked && styles.weekNumberBooked,
                  day.isToday && !marked && styles.weekNumberToday,
                ]}
              >
                {day.dayOfMonth}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1 },
  bell: { padding: spacing.sm },
  /** A dot, not a count: the number was never the point, only that there is news. */
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: c.danger,
    borderWidth: 1.5,
    borderColor: c.background,
  },

  panel: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    ...(shadow.sm as object),
  },
  panelLive: { borderColor: c.accent, borderWidth: 1.5 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  livePip: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
  },
  /**
   * Deliberately larger than the h1 scale. This one line is the screen's
   * answer, and at heading size it read as just another section title.
   */
  bigLine: {
    ...typography.h1,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.8,
    color: c.text,
    marginTop: spacing.sm,
  },
  bigLineSmall: { fontSize: 30, lineHeight: 36 },
  panelSub: { marginTop: spacing.xs },

  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.base,
    paddingHorizontal: spacing.xs,
  },
  weekDay: { alignItems: 'center', gap: spacing.sm },
  weekInitial: { letterSpacing: 0.4 },
  weekDot: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  weekDotToday: { backgroundColor: c.surfaceSubtle },
  weekDotPlanned: { borderColor: c.brandBorder },
  weekDotBooked: { backgroundColor: c.brand, borderColor: c.brand },
  weekNumber: { ...typography.caption, fontWeight: '600', color: c.textSecondary },
  weekNumberBooked: { color: c.textInverse },
  weekNumberToday: { color: c.text },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },

  actions: { marginTop: spacing.lg, gap: spacing.md },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
  },
  planBody: { flex: 1 },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  locationText: { maxWidth: 220 },

  orders: { marginTop: spacing.xxl },
  ordersHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  count: {
    minWidth: 20,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSubtle,
    alignItems: 'center',
  },
  countText: { color: c.textSecondary, fontWeight: '700' },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  orderIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBody: { flex: 1, gap: 2 },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orderRef: { flex: 1, color: c.text },
  orderAction: { marginTop: spacing.xxs, fontWeight: '600' },

  bottomSpace: { height: spacing.xxl },
});
