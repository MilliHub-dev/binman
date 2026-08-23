import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, useStyles, type Colors } from '../theme';
import { Text } from './Text';
import { Button } from './Button';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation before anything irreversible (ui.md §42).
 *
 * The cancel action is deliberately listed first and styled as the primary
 * button: for "Cancel this pickup?", keeping the booking is the safe default.
 */
export const ConfirmModal: React.FC<Props> = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep Booking',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const styles = useStyles(makeStyles);
  return (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
      {/* Stops a tap inside the sheet from dismissing it. */}
      <Pressable style={styles.sheet} onPress={() => {}}>
        <Text variant="h3" center>
          {title}
        </Text>
        {message ? (
          <Text tone="secondary" center style={styles.message}>
            {message}
          </Text>
        ) : null}

        <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} />
        <View style={styles.gap} />
        <Button
          label={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          loading={loading}
          onPress={onConfirm}
        />
      </Pressable>
    </Pressable>
  </Modal>
);
};

const makeStyles = (c: Colors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  message: { marginTop: spacing.sm, marginBottom: spacing.xl },
  gap: { height: spacing.md },
});
