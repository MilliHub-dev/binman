import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useStyles, useTheme, type Colors } from '../theme';
import { Card } from './Card';
import { Icon } from './Icon';
import { Text } from './Text';
import type { Address } from '../api/types';

interface Props {
  address: Address;
  selected?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  /** Hides selection affordances when used purely as a list row. */
  selectable?: boolean;
}

export const AddressCard: React.FC<Props> = ({
  address,
  selected = false,
  onPress,
  onEdit,
  selectable = true,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
  <Card
    onPress={onPress}
    selected={selectable && selected}
    // An address we cannot serve is still shown, but cannot be chosen — the
    // customer needs to understand why, not just find it missing.
    disabled={selectable && !address.serviceable}
    style={styles.card}
  >
    <View style={styles.row}>
      <Icon
        name={address.label.toLowerCase().includes('office') ? 'office' : 'home'}
        size={18}
        color={colors.textSecondary}
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyMedium">{address.label}</Text>
          {address.isDefault ? (
            <View style={styles.defaultTag}>
              <Text variant="caption" tone="brand">
                Default
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="caption" tone="secondary" style={styles.line}>
          {address.addressLine}
        </Text>
        <Text variant="caption" tone="secondary">
          {address.area}, {address.city}
        </Text>

        {!address.serviceable ? (
          <Text variant="caption" tone="danger" style={styles.line}>
            We don't collect here yet
          </Text>
        ) : null}
      </View>

      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={12} accessibilityRole="button" accessibilityLabel="Edit address">
          <Text variant="bodyMedium" tone="brand">
            Edit
          </Text>
        </Pressable>
      ) : selectable && selected ? (
        <View style={styles.tick}>
          <Icon name="check" size={12} color={colors.textInverse} strokeWidth={3} />
        </View>
      ) : null}
    </View>
  </Card>
);
};

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  emoji: { fontSize: 22, marginRight: spacing.md },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  defaultTag: {
    backgroundColor: c.brandSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  line: { marginTop: spacing.xxs },
  tick: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickMark: { color: c.textInverse, fontSize: 13, fontWeight: '700' },
});
