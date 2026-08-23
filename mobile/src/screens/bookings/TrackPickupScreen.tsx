import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, Card, ErrorState, LoadingState, Screen, Text } from '../../components';
import { colors, radius, spacing, useStyles, type Colors } from '../../theme';
import { useBooking } from '../../api/queries';
import type { BookingStatus } from '../../api/types';
import type { RootStackParamList } from '../../navigation/types';

/** The timeline in ui.md §22, in lifecycle order. */
const STEPS: Array<{ status: BookingStatus; label: string }> = [
  { status: 'PAID', label: 'Booking confirmed' },
  { status: 'ASSIGNED', label: 'Team assigned' },
  { status: 'DRIVER_EN_ROUTE', label: 'Driver en route' },
  { status: 'ARRIVED', label: 'Team arrived' },
  { status: 'COLLECTED', label: 'Waste collected' },
  { status: 'COMPLETED', label: 'Completed' },
];

const ORDER: BookingStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'DRIVER_EN_ROUTE',
  'ARRIVED',
  'COLLECTED',
  'COMPLETED',
];

/**
 * Live tracking (ui.md §22–24).
 *
 * `useBooking` polls while the job is live, so this screen updates on its own
 * as the driver moves through the workflow.
 */
export const TrackPickupScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookingId } = useRoute<RouteProp<RootStackParamList, 'TrackPickup'>>().params;
  const { data: booking, isLoading, error, refetch } = useBooking(bookingId);

  if (isLoading) return <Screen><LoadingState /></Screen>;
  if (error || !booking) return <Screen><ErrorState error={error} onRetry={refetch} /></Screen>;

  const currentIndex = ORDER.indexOf(booking.status);
  const driver = booking.assignment?.driver;

  const headline =
    booking.status === 'ARRIVED'
      ? 'Your collection team has arrived'
      : booking.status === 'DRIVER_EN_ROUTE'
        ? 'Your collection team is on the way'
        : booking.status === 'COMPLETED'
          ? 'Pickup completed'
          : 'Your pickup is scheduled';

  return (
    <Screen onRefresh={refetch}>
      <Card style={styles.statusCard}>
        <Text variant="h2">{headline}</Text>
        <Text tone="secondary" style={styles.sub}>
          {booking.status === 'ARRIVED'
            ? 'Please have your waste ready.'
            : `${booking.reference} · ${booking.timeSlot.window}`}
        </Text>
      </Card>

      {/*
        A map view belongs here (ui.md §23). Deferred until @rnmapbox/maps is
        added, which needs a dev build — the driver's coordinates are already
        available on the assignment below.
      */}
      {driver ? (
        <Card style={styles.driverCard}>
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(driver.fullName ?? 'D').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverBody}>
              <Text variant="bodyMedium">{driver.fullName ?? 'Your driver'}</Text>
              {booking.assignment?.truck ? (
                <Text variant="caption" tone="secondary">
                  🚛 {booking.assignment.truck.truckNumber}
                </Text>
              ) : null}
            </View>
            <Button
              label="Call"
              variant="secondary"
              fullWidth={false}
              size="md"
              onPress={() => Linking.openURL(`tel:${driver.phone}`)}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text variant="overline" tone="muted" style={styles.timelineTitle}>
          Progress
        </Text>

        {STEPS.map((step, index) => {
          const stepIndex = ORDER.indexOf(step.status);
          const done = currentIndex > stepIndex;
          const current = booking.status === step.status;
          const isLast = index === STEPS.length - 1;

          return (
            <View key={step.status} style={styles.step}>
              <View style={styles.markerColumn}>
                <View
                  style={[
                    styles.marker,
                    done && styles.markerDone,
                    current && styles.markerCurrent,
                  ]}
                >
                  {done ? <Text style={styles.markerTick}>✓</Text> : null}
                </View>
                {!isLast ? <View style={[styles.connector, done && styles.connectorDone]} /> : null}
              </View>

              <View style={styles.stepBody}>
                <Text
                  variant={current ? 'bodyMedium' : 'body'}
                  tone={done || current ? 'default' : 'muted'}
                >
                  {step.label}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>

      {booking.status === 'COMPLETED' ? (
        <Button
          label="Rate Your Experience"
          onPress={() => navigation.navigate('RateService', { bookingId })}
          style={styles.rate}
        />
      ) : null}

      <View style={styles.bottomSpace} />
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  statusCard: { marginTop: spacing.base, backgroundColor: c.brandSubtle, borderColor: c.brandBorder },
  sub: { marginTop: spacing.xs },
  driverCard: { marginTop: spacing.base, marginBottom: spacing.base },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: c.textInverse, fontSize: 18, fontWeight: '700' },
  driverBody: { flex: 1 },
  timelineTitle: { marginBottom: spacing.base },
  step: { flexDirection: 'row' },
  markerColumn: { alignItems: 'center', width: 28 },
  marker: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: { backgroundColor: c.accent, borderColor: c.accent },
  markerCurrent: { borderColor: c.brand, borderWidth: 5 },
  markerTick: { color: c.textInverse, fontSize: 11, fontWeight: '700' },
  connector: { width: 2, flex: 1, minHeight: 22, backgroundColor: c.border },
  connectorDone: { backgroundColor: c.accent },
  stepBody: { flex: 1, paddingBottom: spacing.lg, paddingLeft: spacing.sm },
  rate: { marginTop: spacing.lg },
  bottomSpace: { height: spacing.xl },
});
