import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  StatusBadge,
  Text,
} from '../../components';
import { spacing } from '../../theme';
import { formatSlotTime, humanise } from '../../utils/format';
import { useCancelSubscription, useSubscriptions, useUpdateSubscription } from '../../api/queries';
import type { ProfileStackParamList } from '../../navigation/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** ui.md §35 — manage recurring collection. */
export const SubscriptionsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { data, isLoading, error, refetch } = useSubscriptions();
  const update = useUpdateSubscription();
  const cancel = useCancelSubscription();
  const [cancelling, setCancelling] = useState<string>();

  if (isLoading) return <Screen><LoadingState /></Screen>;
  if (error) return <Screen><ErrorState error={error} onRetry={refetch} /></Screen>;

  const subscriptions = data ?? [];

  return (
    <Screen
      onRefresh={refetch}
      footer={
        <Button
          label="Set Up Regular Collection"
          onPress={() => navigation.navigate('CreateSubscription')}
        />
      }
    >
      {subscriptions.length === 0 ? (
        <EmptyState
          emoji="🔁"
          title="No subscriptions yet"
          message="Set up weekly collection and never think about it again."
        />
      ) : (
        subscriptions.map((subscription) => (
          <Card key={subscription.id} style={styles.card}>
            <View style={styles.header}>
              <Text variant="h3">
                {humanise(subscription.frequency)} collection
              </Text>
              <StatusBadge status={subscription.status} />
            </View>

            <Text tone="secondary" style={styles.detail}>
              {subscription.daysOfWeek.map((d) => DAY_NAMES[d]).join(', ')} ·{' '}
              {formatSlotTime(subscription.timeSlot.startTime)}
            </Text>
            <Text tone="secondary">📍 {subscription.address.area}</Text>
            <Text variant="bodyMedium" style={styles.price}>
              {subscription.amountFormatted} per pickup
            </Text>

            {subscription.nextRunDateFormatted ? (
              <Text variant="caption" tone="muted">
                Next: {subscription.nextRunDateFormatted}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Button
                label={subscription.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                variant="secondary"
                size="md"
                fullWidth={false}
                loading={update.isPending}
                onPress={() =>
                  update.mutate({
                    id: subscription.id,
                    input: { status: subscription.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' },
                  })
                }
              />
              <Button
                label="Cancel"
                variant="ghost"
                size="md"
                fullWidth={false}
                onPress={() => setCancelling(subscription.id)}
              />
            </View>
          </Card>
        ))
      )}

      <ConfirmModal
        visible={Boolean(cancelling)}
        title="Cancel this subscription?"
        message="Future pickups will stop being created. Bookings already scheduled are unaffected."
        confirmLabel="Cancel Subscription"
        cancelLabel="Keep It"
        loading={cancel.isPending}
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await cancel.mutateAsync(cancelling);
          } finally {
            setCancelling(undefined);
          }
        }}
        onCancel={() => setCancelling(undefined)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: spacing.base },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detail: { marginTop: spacing.sm },
  price: { marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base },
});
