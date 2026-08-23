import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AddressCard, Button, OptionCard, Screen, Text } from '../../components';
import { colors, radius, spacing, useStyles, type Colors } from '../../theme';
import { formatSlotTime } from '../../utils/format';
import { useAddresses, useCreateSubscription, useTimeSlots } from '../../api/queries';
import { ApiError } from '../../api/client';
import type { SubscriptionFrequency } from '../../api/types';

const FREQUENCIES: Array<{ value: SubscriptionFrequency; label: string; description: string }> = [
  { value: 'WEEKLY', label: 'Weekly', description: 'Once a week' },
  { value: 'TWICE_WEEKLY', label: 'Twice weekly', description: 'Two days each week' },
  { value: 'BIWEEKLY', label: 'Every 2 weeks', description: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly', description: 'Once a month' },
];

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** ui.md §36 — "Set up regular collection". */
export const CreateSubscriptionScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const addresses = useAddresses();
  const slots = useTimeSlots();
  const create = useCreateSubscription();

  const [frequency, setFrequency] = useState<SubscriptionFrequency>('WEEKLY');
  const [days, setDays] = useState<number[]>([6]); // Saturday, per ui.md §35
  const [timeSlotId, setTimeSlotId] = useState<string>();
  const [addressId, setAddressId] = useState<string>();

  // Twice-weekly needs exactly two days; the others take exactly one.
  const requiredDays = frequency === 'TWICE_WEEKLY' ? 2 : 1;
  const canSubmit =
    days.length === requiredDays && Boolean(timeSlotId) && Boolean(addressId);

  const toggleDay = (day: number) => {
    setDays((current) => {
      if (current.includes(day)) return current.filter((d) => d !== day);
      // Keep the newest selection and drop the oldest once the limit is hit.
      const next = [...current, day];
      return next.slice(Math.max(0, next.length - requiredDays));
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    await create.mutateAsync({
      serviceType: 'WASTE_COLLECTION',
      frequency,
      daysOfWeek: days,
      timeSlotId: timeSlotId!,
      addressId: addressId!,
      collectionSize: 'MEDIUM',
      wasteTypes: ['HOUSEHOLD'],
    });
    navigation.goBack();
  };

  return (
    <Screen
      footer={
        <Button
          label="Activate Subscription"
          onPress={submit}
          loading={create.isPending}
          disabled={!canSubmit}
        />
      }
    >
      <Text variant="h1" style={styles.title}>
        Set up regular collection
      </Text>

      <Text variant="h3" style={styles.section}>
        How often?
      </Text>
      {FREQUENCIES.map((option) => (
        <OptionCard
          key={option.value}
          title={option.label}
          description={option.description}
          selected={frequency === option.value}
          onPress={() => {
            setFrequency(option.value);
            // Changing frequency can invalidate the day count.
            setDays((current) => current.slice(0, option.value === 'TWICE_WEEKLY' ? 2 : 1));
          }}
        />
      ))}

      <Text variant="h3" style={styles.section}>
        Which day{requiredDays > 1 ? 's' : ''}?
      </Text>
      <View style={styles.days}>
        {DAYS.map((label, index) => {
          const selected = days.includes(index);
          return (
            <Pressable
              key={`${label}-${index}`}
              onPress={() => toggleDay(index)}
              style={[styles.day, selected && styles.daySelected]}
              accessibilityRole="button"
              accessibilityLabel={DAY_LABELS[index]}
              accessibilityState={{ selected }}
            >
              <Text variant="bodyMedium" tone={selected ? 'inverse' : 'secondary'}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="h3" style={styles.section}>
        What time?
      </Text>
      {(slots.data ?? []).map((slot) => (
        <OptionCard
          key={slot.id}
          title={`${formatSlotTime(slot.startTime)} – ${formatSlotTime(slot.endTime)}`}
          selected={timeSlotId === slot.id}
          onPress={() => setTimeSlotId(slot.id)}
        />
      ))}

      <Text variant="h3" style={styles.section}>
        Where?
      </Text>
      {(addresses.data ?? []).map((address) => (
        <AddressCard
          key={address.id}
          address={address}
          selected={addressId === address.id}
          onPress={() => setAddressId(address.id)}
        />
      ))}

      {create.error ? (
        <Text tone="danger">
          {create.error instanceof ApiError ? create.error.message : 'Could not create subscription.'}
        </Text>
      ) : null}

      <View style={styles.bottomSpace} />
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  title: { marginTop: spacing.base, marginBottom: spacing.lg },
  section: { marginTop: spacing.lg, marginBottom: spacing.md },
  days: { flexDirection: 'row', gap: spacing.sm },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: c.brand, borderColor: c.brand },
  bottomSpace: { height: spacing.xl },
});
