import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { Card } from './Card';
import { Text } from './Text';
import { StatusBadge } from './StatusBadge';
import { formatNaira, formatRelativeDate, formatSlotTime, humanise } from '../utils/format';
import type { Booking } from '../api/types';

interface Props {
  booking: Booking;
  onPress: () => void;
}

/** The booking row on Home and the Bookings tab (ui.md §26). */
export const BookingCard: React.FC<Props> = ({ booking, onPress }) => {
  const isWaste = booking.serviceType === 'WASTE_COLLECTION';
  const detail = isWaste
    ? booking.waste
      ? humanise(booking.waste.collectionSize)
      : null
    : booking.cleaning
      ? humanise(booking.cleaning.cleaningType)
      : null;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text variant="overline" tone="muted">
          {isWaste ? 'Waste Collection' : 'Cleaning'}
        </Text>
        <StatusBadge status={booking.status} label={booking.statusLabel} />
      </View>

      <Text variant="h3" style={styles.when}>
        {formatRelativeDate(booking.scheduledDate)} · {formatSlotTime(booking.timeSlot.startTime)}
      </Text>

      <View style={styles.metaRow}>
        <Text variant="caption" tone="secondary">
          {booking.address.area}
        </Text>
        {detail ? (
          <Text variant="caption" tone="secondary">
            {detail}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text variant="caption" tone="muted">
          {booking.reference}
        </Text>
        <Text variant="bodyMedium">{formatNaira(booking.pricing.total)}</Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  when: { marginTop: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
