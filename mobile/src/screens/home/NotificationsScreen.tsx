import React from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Screen,
  Text,
  type IconName,
} from '../../components';
import { radius, spacing, useStyles, useTheme, type Colors } from '../../theme';
import { formatTimeAgo } from '../../utils/format';
import { useMarkAllRead, useNotifications } from '../../api/queries';
import { markNotificationRead } from '../../api/endpoints';
import type { Notification } from '../../api/types';
import type { RootStackParamList } from '../../navigation/types';

/**
 * ui.md §37 — what happened, and when.
 *
 * This was a flat list of rows, each led by a vendor emoji, with unread items
 * filled solid blue. Two problems: a screenful of blue blocks made "unread"
 * shout louder than the messages themselves, and an undated list of "2h ago"
 * strings gives no sense of what happened today versus last week.
 *
 * So it is grouped by day, and unread is marked with a rule down the edge and a
 * dot rather than a filled row — enough to find them, quiet enough to read past.
 */

/** Notification type -> icon and the tone that carries its meaning. */
const APPEARANCE: Record<string, { icon: IconName; tone: 'brand' | 'accent' | 'danger' | 'muted' }> =
  {
    BOOKING_CONFIRMED: { icon: 'check', tone: 'accent' },
    TEAM_ASSIGNED: { icon: 'profile', tone: 'brand' },
    DRIVER_EN_ROUTE: { icon: 'waste', tone: 'accent' },
    DRIVER_ARRIVED: { icon: 'pin', tone: 'accent' },
    BOOKING_COMPLETED: { icon: 'check', tone: 'accent' },
    BOOKING_CANCELLED: { icon: 'close', tone: 'muted' },
    BOOKING_FAILED: { icon: 'alert', tone: 'danger' },
    PAYMENT_RECEIVED: { icon: 'card', tone: 'brand' },
    PICKUP_REMINDER: { icon: 'schedule', tone: 'brand' },
    REVIEW_REQUEST: { icon: 'star', tone: 'brand' },
    TICKET_RESOLVED: { icon: 'support', tone: 'accent' },
  };

const DEFAULT_APPEARANCE = { icon: 'bell' as IconName, tone: 'muted' as const };

/** "Today", "Yesterday", or the date — the heading a person would use. */
const dayLabel = (iso: string): string => {
  const date = new Date(iso);
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(date)) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-NG', { weekday: 'long' });
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'long' });
};

const groupByDay = (items: Notification[]): Array<{ title: string; data: Notification[] }> => {
  const sections: Array<{ title: string; data: Notification[] }> = [];
  for (const item of items) {
    const title = dayLabel(item.createdAt);
    const current = sections[sections.length - 1];
    if (current?.title === title) current.data.push(item);
    else sections.push({ title, data: [item] });
  }
  return sections;
};

export const NotificationsScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, isLoading, error, refetch, isRefetching } = useNotifications();
  const markAll = useMarkAllRead();

  if (isLoading)
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (error)
    return (
      <Screen>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const open = async (notification: Notification) => {
    // Fire and forget: the read state is not worth blocking navigation on.
    void markNotificationRead(notification.id).then(() => refetch());

    const bookingId = (notification.metadata as { bookingId?: string } | null)?.bookingId;
    if (!bookingId) return;

    // A "how did we do?" nudge should open the rating screen, not the booking
    // details — sending someone to a receipt when you asked them a question is
    // how an app wastes the one tap it gets.
    navigation.navigate(
      notification.type === 'REVIEW_REQUEST' ? 'RateService' : 'BookingDetail',
      { bookingId },
    );
  };

  const toneColor = (tone: 'brand' | 'accent' | 'danger' | 'muted') =>
    tone === 'accent'
      ? colors.accentPressed
      : tone === 'danger'
        ? colors.danger
        : tone === 'muted'
          ? colors.textMuted
          : colors.brand;

  return (
    <Screen scroll={false}>
      {unreadCount > 0 ? (
        <View style={styles.header}>
          <Text variant="caption" tone="muted">
            {unreadCount} unread
          </Text>
          <Pressable
            onPress={() => markAll.mutate()}
            hitSlop={8}
            accessibilityRole="button"
            disabled={markAll.isPending}
          >
            <Text variant="caption" tone="brand" style={styles.markAll}>
              {markAll.isPending ? 'Marking…' : 'Mark all read'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <SectionList
        sections={groupByDay(notifications)}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <Text variant="overline" tone="muted" style={styles.day}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const look = APPEARANCE[item.type] ?? DEFAULT_APPEARANCE;
          const unread = !item.readAt;

          return (
            <Pressable
              onPress={() => open(item)}
              style={[styles.row, unread && styles.rowUnread]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.message}`}
            >
              <View style={[styles.icon, { backgroundColor: `${toneColor(look.tone)}1A` }]}>
                <Icon name={look.icon} size={16} color={toneColor(look.tone)} />
              </View>

              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text variant="bodyMedium" style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {unread ? <View style={styles.dot} /> : null}
                </View>
                <Text variant="caption" tone="secondary" style={styles.message}>
                  {item.message}
                </Text>
                <Text variant="caption" tone="muted" style={styles.time}>
                  {formatTimeAgo(item.createdAt)}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="Nothing yet"
            message="When a pickup is confirmed, on its way, or done, you'll hear about it here."
          />
        }
      />
    </Screen>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    markAll: { fontWeight: '600' },

    list: { flexGrow: 1, paddingBottom: spacing.xxl },
    day: { marginTop: spacing.lg, marginBottom: spacing.sm },

    row: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingRight: spacing.sm,
      paddingLeft: spacing.md,
      borderRadius: radius.md,
      /**
       * Unread is a rule down the edge, not a filled row. A list of solid blue
       * blocks makes the state louder than the message it is attached to.
       */
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    rowUnread: { borderLeftColor: c.brand, backgroundColor: c.surface },

    icon: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { flex: 1, color: c.text },
    dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: c.brand },
    message: { marginTop: spacing.xxs },
    time: { marginTop: spacing.xs },
  });
