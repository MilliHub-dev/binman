import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Button, ErrorState, Screen, StepHeader, Text } from '../../components';
import { colors, radius, spacing, useStyles, type Colors } from '../../theme';
import { asSlotList, useAvailability } from '../../api/queries';
import { useBookingDraft } from '../../store/bookingDraft';
import { formatRelativeDate, formatSlotTime } from '../../utils/format';
import type { BookingStackParamList } from '../../navigation/types';

const DAYS_AHEAD = 14;

/**
 * Step 4 (ui.md §17) — date strip plus time slots.
 *
 * Availability is fetched per selected date, and unavailable slots are shown
 * disabled with the reason rather than hidden: a customer who cannot find the
 * 8am slot assumes the app is broken, not that it is full.
 */
export const DateTimeScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<BookingStackParamList>>();

  const draftDate = useBookingDraft((state) => state.scheduledDate);
  const draftSlot = useBookingDraft((state) => state.timeSlotId);
  const setSchedule = useBookingDraft((state) => state.setSchedule);

  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      return day.toISOString().slice(0, 10);
    });
  }, []);

  const [date, setDate] = useState(draftDate ?? dates[0]!);
  const { data, isLoading, error, refetch } = useAvailability(date, 1);
  const slots = asSlotList(data);

  const select = (slotId: string) => setSchedule(date, slotId);

  return (
    <Screen
      footer={
        <Button
          label="Continue"
          onPress={() => navigation.navigate('Review')}
          disabled={!draftSlot || draftDate !== date}
        />
      }
    >
      <StepHeader title="When should we come?" step={4} totalSteps={5} />

      <FlatList
        data={dates}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.strip}
        renderItem={({ item }) => {
          const isSelected = item === date;
          const [, month, day] = item.split('-');
          return (
            <Pressable
              onPress={() => setDate(item)}
              style={[styles.dateCard, isSelected && styles.dateCardSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                variant="caption"
                tone={isSelected ? 'inverse' : 'secondary'}
                numberOfLines={1}
              >
                {formatRelativeDate(item).split(' ')[0]}
              </Text>
              <Text variant="h3" tone={isSelected ? 'inverse' : 'default'} style={styles.dayNumber}>
                {day}
              </Text>
              <Text variant="caption" tone={isSelected ? 'inverse' : 'muted'}>
                {new Date(`${item}T00:00:00Z`).toLocaleDateString('en-NG', {
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </Text>
            </Pressable>
          );
        }}
      />

      <Text variant="h3" style={styles.slotsTitle}>
        Choose a time
      </Text>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <View style={styles.slotSkeletonWrap}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.slotSkeleton} />
          ))}
        </View>
      ) : slots.length === 0 ? (
        <Text tone="secondary">No slots are offered on this date. Please choose another day.</Text>
      ) : (
        slots.map((slot) => {
          const isSelected = draftSlot === slot.id && draftDate === date;
          const reason =
            slot.unavailableReason === 'FULL'
              ? 'Fully booked'
              : slot.unavailableReason === 'PAST'
                ? 'Already started'
                : undefined;

          return (
            <Pressable
              key={slot.id}
              onPress={() => slot.available && select(slot.id)}
              disabled={!slot.available}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: !slot.available }}
              style={[
                styles.slot,
                isSelected && styles.slotSelected,
                !slot.available && styles.slotDisabled,
              ]}
            >
              <Text variant="bodyMedium" tone={isSelected ? 'inverse' : 'default'}>
                {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
              </Text>
              {reason ? (
                <Text variant="caption" tone="muted">
                  {reason}
                </Text>
              ) : slot.remaining <= 3 ? (
                <Text variant="caption" tone={isSelected ? 'inverse' : 'danger'}>
                  {slot.remaining} left
                </Text>
              ) : null}
            </Pressable>
          );
        })
      )}

      <View style={styles.bottomSpace} />
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  strip: { gap: spacing.sm, paddingBottom: spacing.lg },
  dateCard: {
    width: 68,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
  },
  dateCardSelected: { backgroundColor: c.brand, borderColor: c.brand },
  dayNumber: { marginVertical: 2 },
  slotsTitle: { marginBottom: spacing.md },
  slot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    marginBottom: spacing.md,
  },
  slotSelected: { backgroundColor: c.brand, borderColor: c.brand },
  slotDisabled: { opacity: 0.45, backgroundColor: c.surfaceSubtle },
  slotSkeletonWrap: { gap: spacing.md },
  slotSkeleton: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: c.skeleton,
  },
  bottomSpace: { height: spacing.xl },
});
