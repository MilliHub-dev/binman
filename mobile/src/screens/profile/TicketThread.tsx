import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '../../components';
import { radius, spacing, useStyles, useTheme, type Colors } from '../../theme';
import { formatTimeAgo } from '../../utils/format';
import { useReplyToTicket, useTicketMessages } from '../../api/queries';

/**
 * The conversation on one support ticket.
 *
 * Raising an issue used to be a one-way street — the customer described a
 * problem, staff read it, and the only reply channel was a phone call. Someone
 * who reported a missed pickup had no way of knowing whether anyone had even
 * looked.
 */
export const TicketThread: React.FC<{ ticketId: string }> = ({ ticketId }) => {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [body, setBody] = useState('');

  const { data: messages, isLoading } = useTicketMessages(ticketId);
  const reply = useReplyToTicket(ticketId);

  const send = async () => {
    const text = body.trim();
    if (!text || reply.isPending) return;
    await reply.mutateAsync(text);
    setBody('');
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {(messages ?? []).length === 0 ? (
        <Text variant="caption" tone="muted" style={styles.empty}>
          No replies yet. We usually answer within a few hours.
        </Text>
      ) : (
        (messages ?? []).map((message) => (
          <View
            key={message.id}
            style={[styles.bubble, message.fromStaff ? styles.fromStaff : styles.fromMe]}
          >
            <Text variant="caption" style={styles.bubbleText}>
              {message.body}
            </Text>
            <Text variant="caption" tone="muted" style={styles.stamp}>
              {message.fromStaff ? 'BinMan' : 'You'} · {formatTimeAgo(message.createdAt)}
            </Text>
          </View>
        ))
      )}

      <View style={styles.composer}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write a reply…"
          placeholderTextColor={colors.textDisabled}
          multiline
          maxLength={2000}
          style={styles.input}
        />
        <Pressable
          onPress={send}
          disabled={!body.trim() || reply.isPending}
          style={[styles.send, (!body.trim() || reply.isPending) && styles.sendDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Send reply"
        >
          <Text variant="caption" tone="inverse" style={styles.sendLabel}>
            {reply.isPending ? '…' : 'Send'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrapper: { marginTop: spacing.md },
    loading: { paddingVertical: spacing.lg },
    empty: { paddingVertical: spacing.sm },

    bubble: {
      maxWidth: '88%',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
    },
    /** Staff on the left, you on the right — the usual reading of a thread. */
    fromStaff: { alignSelf: 'flex-start', backgroundColor: c.surfaceSubtle },
    fromMe: { alignSelf: 'flex-end', backgroundColor: c.brandSubtle },
    bubbleText: { color: c.text },
    stamp: { marginTop: 2 },

    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
    },
    send: {
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.brand,
    },
    sendDisabled: { opacity: 0.45 },
    sendLabel: { fontWeight: '700' },
  });
