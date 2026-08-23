import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonActions, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { Icon, Button, Card, Screen, Text } from '../../components';
import { colors, gradients, spacing, useStyles, type Colors, useTheme } from '../../theme';
import { formatLongDate } from '../../utils/format';
import { useBooking } from '../../api/queries';
import type { BookingStackParamList } from '../../navigation/types';

/** ui.md §21 — booking success. */
export const ConfirmationScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const { bookingId } = useRoute<RouteProp<BookingStackParamList, 'Confirmation'>>().params;
  const { data: booking } = useBooking(bookingId);

  /**
   * Resets the whole navigation state back to the tabs. Without this, the back
   * gesture would walk the customer through the booking steps of a booking
   * they have already paid for.
   */
  const goHome = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Tabs' }] }),
    );
  };

  const track = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [{ name: 'Tabs' }, { name: 'TrackPickup', params: { bookingId } }],
      }),
    );
  };

  return (
    <Screen
      footer={
        <View>
          <Button label="Track Pickup" onPress={track} />
          <Button label="Back to Home" variant="ghost" onPress={goHome} style={styles.secondary} />
        </View>
      }
    >
      <View style={styles.hero}>
        <LinearGradient
          colors={gradients.success}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tickCircle}
        >
          <Icon name="check" size={34} color={colors.textInverse} strokeWidth={3} />
        </LinearGradient>
        <Text variant="h1" center style={styles.title}>
          Pickup booked
        </Text>
        <Text tone="secondary" center>
          Your waste collection has been scheduled successfully.
        </Text>
      </View>

      {booking ? (
        <Card style={styles.details}>
          <Text variant="overline" tone="muted">
            Booking reference
          </Text>
          <Text variant="h2" style={styles.reference}>
            {booking.reference}
          </Text>

          <View style={styles.divider} />

          <Text variant="bodyMedium">{formatLongDate(booking.scheduledDate)}</Text>
          <Text tone="secondary">{booking.timeSlot.window}</Text>
          <Text tone="secondary" style={styles.address}>
            {booking.address.area}, {booking.address.city}
          </Text>
        </Card>
      ) : null}

      <Text variant="caption" tone="muted" center style={styles.footNote}>
        We'll notify you when your collection team is on the way.
      </Text>
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: spacing.huge },
  tickCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  tick: { fontSize: 44, color: c.textInverse, fontWeight: '700' },
  title: { marginBottom: spacing.sm },
  details: { marginTop: spacing.xxl },
  reference: { marginTop: spacing.xxs },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginVertical: spacing.base,
  },
  address: { marginTop: spacing.sm },
  footNote: { marginTop: spacing.lg },
  secondary: { marginTop: spacing.sm },
});
