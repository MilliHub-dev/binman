import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  BookingCard,
  BookingCardSkeleton,
  EmptyState,
  ErrorState,
  Screen,
  Text,
} from '../../components';
import { colors, radius, spacing, useStyles, type Colors } from '../../theme';
import { useBookings } from '../../api/queries';
import { useBookingDraft } from '../../store/bookingDraft';
import type { BookingScope } from '../../api/endpoints';
import type { RootStackParamList } from '../../navigation/types';

const TABS: Array<{ key: BookingScope; label: string }> = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

/** ui.md §26–27 — the Bookings tab. */
export const BookingsScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const startDraft = useBookingDraft((state) => state.start);
  const [scope, setScope] = useState<BookingScope>('upcoming');

  const { data, isLoading, error, refetch, isRefetching } = useBookings(scope);

  const openBooking = (id: string, isActive: boolean) =>
    navigation.navigate(isActive ? 'TrackPickup' : 'BookingDetail', { bookingId: id });

  return (
    <Screen scroll={false} edges={['top']}>
      <Text variant="h1" style={styles.title}>
        My bookings
      </Text>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = tab.key === scope;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setScope(tab.key)}
              style={[styles.tab, isActive && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text variant="bodyMedium" tone={isActive ? 'inverse' : 'secondary'}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <View style={styles.list}>
          <BookingCardSkeleton />
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={() => openBooking(item.id, scope === 'active')} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={scope === 'completed' ? 'check' : 'calendar'}
              title={scope === 'completed' ? 'Nothing completed yet' : 'No bookings yet'}
              message={
                scope === 'active'
                  ? 'Bookings currently being collected will appear here.'
                  : 'Your waste collection bookings will appear here.'
              }
              {...(scope !== 'completed'
                ? {
                    actionLabel: 'Book a Pickup',
                    onAction: () => {
                      startDraft('WASTE_COLLECTION');
                      navigation.navigate('Booking', {
                        screen: 'SelectAddress',
                        params: { serviceType: 'WASTE_COLLECTION' },
                      });
                    },
                  }
                : {})}
            />
          }
        />
      )}
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  title: { marginTop: spacing.md, marginBottom: spacing.lg },
  tabs: {
    flexDirection: 'row',
    backgroundColor: c.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: c.brand },
  list: { paddingBottom: spacing.xxl, flexGrow: 1 },
});
