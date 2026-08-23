import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { Card, Screen, Text } from '../../components';
import { spacing, useStyles, type Colors, useTheme } from '../../theme';
import { updateNotificationPreferences } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';

type Channel = 'push' | 'sms' | 'whatsapp' | 'email';

const CHANNELS: Array<{ key: Channel; label: string; description: string }> = [
  { key: 'push', label: 'Push notifications', description: 'Alerts on this device' },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Booking updates on WhatsApp' },
  { key: 'sms', label: 'SMS', description: 'Text messages for important updates' },
  { key: 'email', label: 'Email', description: 'Receipts and confirmations' },
];

export const NotificationSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const save = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: setUser,
  });

  const preferences = user?.notificationPreferences;

  return (
    <Screen>
      <Text tone="secondary" style={styles.intro}>
        Choose how we keep you updated about your pickups.
      </Text>

      <Card padded={false}>
        {CHANNELS.map((channel, index) => (
          <View key={channel.key} style={[styles.row, index > 0 && styles.divided]}>
            <View style={styles.body}>
              <Text variant="bodyMedium">{channel.label}</Text>
              <Text variant="caption" tone="secondary">
                {channel.description}
              </Text>
            </View>
            <Switch
              value={preferences?.[channel.key] ?? true}
              // Sends only the changed key; the server merges the rest.
              onValueChange={(value) => save.mutate({ [channel.key]: value })}
              disabled={save.isPending}
              trackColor={{ true: colors.brand, false: colors.borderStrong }}
              thumbColor={colors.surface}
            />
          </View>
        ))}
      </Card>

      <Text variant="caption" tone="muted" style={styles.note}>
        We'll always send critical updates about a booking you've paid for, regardless of these
        settings.
      </Text>
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  intro: { marginTop: spacing.base, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.base },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  body: { flex: 1, marginRight: spacing.base },
  note: { marginTop: spacing.lg },
});
