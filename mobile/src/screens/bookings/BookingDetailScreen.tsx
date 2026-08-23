import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  Button,
  Card,
  ConfirmModal,
  ErrorState,
  LoadingState,
  PriceSummary,
  Screen,
  StatusBadge,
  Text,
} from '../../components';
import { colors, spacing, useStyles, type Colors } from '../../theme';
import { formatLongDate, humanise } from '../../utils/format';
import { useBooking, useCancelBooking } from '../../api/queries';
import { ApiError } from '../../api/client';
import type { RootStackParamList } from '../../navigation/types';

const CANCELLABLE = ['PENDING_PAYMENT', 'PAID', 'PENDING_ASSIGNMENT', 'ASSIGNED'];
const TRACKABLE = ['ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'COLLECTED'];

export const BookingDetailScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookingId } = useRoute<RouteProp<RootStackParamList, 'BookingDetail'>>().params;

  const { data: booking, isLoading, error, refetch } = useBooking(bookingId);
  const cancel = useCancelBooking();
  const [confirming, setConfirming] = useState(false);

  if (isLoading) return <Screen><LoadingState /></Screen>;
  if (error || !booking) {
    return <Screen><ErrorState error={error} onRetry={refetch} /></Screen>;
  }

  const doCancel = async () => {
    await cancel.mutateAsync({ id: bookingId });
    setConfirming(false);
  };

  const rows = [
    { label: 'Reference', value: booking.reference },
    { label: 'Date', value: formatLongDate(booking.scheduledDate) },
    { label: 'Time', value: booking.timeSlot.window },
    { label: 'Address', value: `${booking.address.addressLine}, ${booking.address.area}` },
    ...(booking.waste
      ? [
          { label: 'Waste', value: booking.waste.wasteTypes.map(humanise).join(', ') },
          { label: 'Size', value: humanise(booking.waste.collectionSize) },
        ]
      : []),
    ...(booking.cleaning
      ? [
          { label: 'Cleaning', value: humanise(booking.cleaning.cleaningType) },
          { label: 'Property', value: humanise(booking.cleaning.propertySize) },
        ]
      : []),
    ...(booking.notes ? [{ label: 'Notes', value: booking.notes }] : []),
  ];

  return (
    <Screen
      onRefresh={refetch}
      footer={
        <View>
          {TRACKABLE.includes(booking.status) ? (
            <Button
              label="Track Pickup"
              onPress={() => navigation.navigate('TrackPickup', { bookingId })}
            />
          ) : booking.status === 'PENDING_PAYMENT' ? (
            <Button
              label="Complete Payment"
              onPress={() =>
                navigation.navigate('Booking', {
                  screen: 'Payment',
                  params: { bookingId },
                })
              }
            />
          ) : booking.status === 'COMPLETED' ? (
            <Button
              label="Rate Your Experience"
              onPress={() => navigation.navigate('RateService', { bookingId })}
            />
          ) : null}

          {CANCELLABLE.includes(booking.status) ? (
            <Button
              label="Cancel Booking"
              variant="ghost"
              onPress={() => setConfirming(true)}
              style={styles.cancel}
            />
          ) : null}
        </View>
      }
    >
      <View style={styles.header}>
        <Text variant="overline" tone="muted">
          {booking.serviceType === 'WASTE_COLLECTION' ? 'Waste Collection' : 'Cleaning'}
        </Text>
        <StatusBadge status={booking.status} label={booking.statusLabel} />
      </View>

      <Card style={styles.card}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.divided]}>
            <Text variant="caption" tone="muted">
              {row.label}
            </Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))}
      </Card>

      {booking.assignment?.driver ? (
        <Card style={styles.card}>
          <Text variant="overline" tone="muted">
            Your collection team
          </Text>
          <Text variant="h3" style={styles.value}>
            {booking.assignment.driver.fullName ?? 'Assigned driver'}
          </Text>
          {booking.assignment.truck ? (
            <Text tone="secondary">Truck {booking.assignment.truck.truckNumber}</Text>
          ) : null}
          <Button
            label="Call Driver"
            variant="secondary"
            onPress={() => Linking.openURL(`tel:${booking.assignment!.driver!.phone}`)}
            style={styles.call}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text variant="overline" tone="muted">
          Payment
        </Text>
        <PriceSummary
          breakdown={[
            { label: 'Collection', amount: booking.pricing.subtotal },
            { label: 'Service fee', amount: booking.pricing.serviceFee },
          ]}
          total={booking.pricing.total}
          discount={booking.pricing.discount}
        />
        <Text variant="caption" tone={booking.paymentStatus === 'SUCCESSFUL' ? 'success' : 'muted'}>
          {booking.paymentStatus === 'SUCCESSFUL' ? '✓ Paid' : humanise(booking.paymentStatus)}
        </Text>
      </Card>

      {cancel.error ? (
        <Text tone="danger" style={styles.error}>
          {cancel.error instanceof ApiError ? cancel.error.message : 'Could not cancel.'}
        </Text>
      ) : null}

      <ConfirmModal
        visible={confirming}
        title="Cancel this pickup?"
        message="Are you sure you want to cancel this booking? Refunds are reviewed by our team."
        confirmLabel="Cancel Pickup"
        cancelLabel="Keep Booking"
        loading={cancel.isPending}
        onConfirm={doCancel}
        onCancel={() => setConfirming(false)}
      />

      <View style={styles.bottomSpace} />
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.base,
    marginBottom: spacing.base,
  },
  card: { marginBottom: spacing.base },
  row: { paddingVertical: spacing.md },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  value: { marginTop: spacing.xxs },
  call: { marginTop: spacing.base },
  cancel: { marginTop: spacing.xs },
  error: { marginBottom: spacing.base },
  bottomSpace: { height: spacing.xl },
});
