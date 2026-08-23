import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing, useStyles, type Colors } from '../theme';
import { Text } from './Text';
import { formatNaira } from '../utils/format';

interface Props {
  breakdown: Array<{ label: string; amount: number }>;
  total: number;
  discount?: number;
}

/**
 * The price block on the review screen (ui.md §18).
 *
 * Every line comes from the server's quote — the app never computes a price,
 * only renders one (prd.md §12).
 */
export const PriceSummary: React.FC<Props> = ({ breakdown, total, discount = 0 }) => {
  const styles = useStyles(makeStyles);
  return (
  <View style={styles.wrapper}>
    {breakdown.map((line) => (
      <View key={line.label} style={styles.row}>
        <Text tone="secondary">{line.label}</Text>
        <Text>{formatNaira(line.amount)}</Text>
      </View>
    ))}

    {discount > 0 ? (
      <View style={styles.row}>
        <Text tone="secondary">Discount</Text>
        <Text tone="success">−{formatNaira(discount)}</Text>
      </View>
    ) : null}

    <View style={styles.divider} />

    <View style={styles.row}>
      <Text variant="h3">Total</Text>
      <Text variant="h3">{formatNaira(total)}</Text>
    </View>
  </View>
);
};

const makeStyles = (c: Colors) => StyleSheet.create({
  wrapper: { marginTop: spacing.base },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderStrong,
    marginVertical: spacing.sm,
  },
});
