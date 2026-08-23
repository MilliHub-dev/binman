import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing, useStyles, type Colors } from '../theme';
import { Card } from './Card';
import { Text } from './Text';

interface Props {
  title: string;
  description?: string;
  /** Emoji rather than an icon font — ui.md uses them throughout. */
  emoji?: string;
  price?: string;
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onPress: () => void;
  testID?: string;
}

/**
 * The selectable row used by every choice step: waste type, size, cleaning
 * type, property, payment method. One component keeps those five screens
 * visually identical, which is what makes the flow feel short.
 */
export const OptionCard: React.FC<Props> = ({
  title,
  description,
  emoji,
  price,
  selected,
  disabled = false,
  disabledReason,
  onPress,
  testID,
}) => {
  const styles = useStyles(makeStyles);
  return (
  <Card
    testID={testID}
    onPress={disabled ? undefined : onPress}
    selected={selected}
    disabled={disabled}
    style={styles.card}
  >
    <View style={styles.row}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}

      <View style={styles.body}>
        <Text variant="bodyMedium">{title}</Text>
        {description ? (
          <Text variant="caption" tone="secondary" style={styles.description}>
            {description}
          </Text>
        ) : null}
        {disabled && disabledReason ? (
          <Text variant="caption" tone="danger" style={styles.description}>
            {disabledReason}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {price ? (
          <Text variant="bodyMedium" tone={selected ? 'brand' : 'default'}>
            {price}
          </Text>
        ) : null}
        {/* A tick, not just a colour change — selection must survive greyscale. */}
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <Text style={styles.tick}>✓</Text> : null}
        </View>
      </View>
    </View>
  </Card>
);
};

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 26, marginRight: spacing.md },
  body: { flex: 1 },
  description: { marginTop: spacing.xxs },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: c.brand, backgroundColor: c.brand },
  tick: { color: c.textInverse, fontSize: 13, fontWeight: '700', lineHeight: 16 },
});
