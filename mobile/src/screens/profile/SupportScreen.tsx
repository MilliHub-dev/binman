import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Icon, Button, Card, Input, Screen, StatusBadge, Text } from '../../components';
import { colors, spacing, useStyles, type Colors, useTheme } from '../../theme';
import { formatTimeAgo } from '../../utils/format';
import { useCreateTicket, useTickets } from '../../api/queries';
import { TicketThread } from './TicketThread';
import { ApiError } from '../../api/client';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_WHATSAPP,
} from '../../config/contact';



/** ui.md §38 — support options plus a ticket form. */
export const SupportScreen: React.FC = () => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { data: tickets } = useTickets();
  const createTicket = useCreateTicket();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);
  /** One thread at a time; a page of expanded conversations is unreadable. */
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const canSubmit = subject.trim().length > 2 && description.trim().length > 4;

  const submit = async () => {
    if (!canSubmit) return;
    await createTicket.mutateAsync({ subject: subject.trim(), description: description.trim() });
    setSubject('');
    setDescription('');
    setSent(true);
  };

  const channels = [
    {
      icon: 'support' as const,
      label: 'WhatsApp support',
      detail: 'Fastest response',
      onPress: () => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`),
    },
    {
      icon: 'phone' as const,
      label: 'Call us',
      detail: SUPPORT_PHONE_DISPLAY,
      onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`),
    },
    {
      icon: 'mail' as const,
      label: 'Email us',
      detail: SUPPORT_EMAIL,
      onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`),
    },
  ];

  return (
    <Screen>
      <Card padded={false} style={styles.channels}>
        {channels.map((channel, index) => (
          <Pressable
            key={channel.label}
            onPress={channel.onPress}
            style={[styles.row, index > 0 && styles.divided]}
            accessibilityRole="button"
          >
            <View style={styles.channelIcon}>
              <Icon name={channel.icon} size={18} color={colors.brand} />
            </View>
            <View style={styles.rowBody}>
              <Text variant="bodyMedium">{channel.label}</Text>
              <Text variant="caption" tone="secondary">
                {channel.detail}
              </Text>
            </View>
            <Text tone="muted">›</Text>
          </Pressable>
        ))}
      </Card>

      <Text variant="h3" style={styles.section}>
        Raise an issue
      </Text>

      <Input label="Subject" value={subject} onChangeText={setSubject} placeholder="What's it about?" />
      <Input
        label="Describe the issue"
        value={description}
        onChangeText={setDescription}
        placeholder="Tell us what happened…"
        multiline
        numberOfLines={4}
        style={styles.multiline}
        error={createTicket.error instanceof ApiError ? createTicket.error.message : undefined}
      />

      <Button
        label="Send to Support"
        onPress={submit}
        loading={createTicket.isPending}
        disabled={!canSubmit}
      />

      {sent ? (
        <Text tone="success" center style={styles.sent}>
          Sent. Our team will be in touch shortly.
        </Text>
      ) : null}

      {tickets && tickets.length > 0 ? (
        <View style={styles.history}>
          <Text variant="h3" style={styles.section}>
            Your tickets
          </Text>
          {tickets.map((ticket) => (
            <Card key={ticket.id} style={styles.ticket}>
              <Pressable
                onPress={() =>
                  setOpenTicket((current) => (current === ticket.id ? null : ticket.id))
                }
                accessibilityRole="button"
                accessibilityLabel={`${ticket.subject}. Tap to ${openTicket === ticket.id ? 'hide' : 'view'} the conversation.`}
              >
                <View style={styles.ticketHeader}>
                  <Text variant="caption" tone="muted">
                    {ticket.ticketNumber}
                  </Text>
                  <StatusBadge status={ticket.status} />
                </View>
                <Text variant="bodyMedium" style={styles.ticketSubject}>
                  {ticket.subject}
                </Text>
                <Text variant="caption" tone="brand">
                  {openTicket === ticket.id ? 'Hide conversation' : 'View conversation'} ·{' '}
                  {formatTimeAgo(ticket.createdAt)}
                </Text>
              </Pressable>

              {openTicket === ticket.id ? <TicketThread ticketId={ticket.id} /> : null}
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.bottomSpace} />
    </Screen>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  channels: { marginTop: spacing.base },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.base },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  channelIcon: { width: 34, alignItems: 'center', marginRight: spacing.md },
  rowBody: { flex: 1 },
  section: { marginTop: spacing.xl, marginBottom: spacing.md },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  sent: { marginTop: spacing.base },
  history: { marginTop: spacing.sm },
  ticket: { marginBottom: spacing.md },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketSubject: { marginTop: spacing.xs, marginBottom: spacing.xs },
  bottomSpace: { height: spacing.xl },
});
