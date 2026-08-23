import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing, useStyles, type Colors } from '../theme';
import { Text } from './Text';

interface Props {
  title: string;
  subtitle?: string;
  /** 1-based position in the booking flow. */
  step?: number;
  totalSteps?: number;
}

/**
 * Heading for each step of the booking flow, with a progress bar.
 *
 * The customer should be able to see how much is left — ui.md §1 targets the
 * whole booking in under 2–3 minutes, and progress is what makes that feel
 * true.
 */
export const StepHeader: React.FC<Props> = ({ title, subtitle, step, totalSteps }) => {
  const styles = useStyles(makeStyles);
  return (
  <View style={styles.wrapper}>
    {step && totalSteps ? (
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(step / totalSteps) * 100}%` }]} />
        </View>
        <Text variant="caption" tone="muted" style={styles.count}>
          {step}/{totalSteps}
        </Text>
      </View>
    ) : null}

    <Text variant="h1">{title}</Text>
    {subtitle ? (
      <Text tone="secondary" style={styles.subtitle}>
        {subtitle}
      </Text>
    ) : null}
  </View>
);
};

const makeStyles = (c: Colors) => StyleSheet.create({
  wrapper: { marginTop: spacing.base, marginBottom: spacing.xl },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  track: {
    flex: 1,
    height: 4,
    backgroundColor: c.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: c.brand, borderRadius: radius.pill },
  count: { marginLeft: spacing.md },
  subtitle: { marginTop: spacing.sm },
});
