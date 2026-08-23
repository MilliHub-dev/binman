import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  darkStatusColors,
  radius,
  spacing,
  statusColors,
  typography,
  useTheme,
  type StatusColorKey,
} from '../theme';
import { Text } from './Text';

interface Props {
  status: string;
  /** The server sends a human label; fall back to the raw status if absent. */
  label?: string;
}

const humanise = (value: string): string => {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export const StatusBadge: React.FC<Props> = ({ status, label }) => {
  const { isDark } = useTheme();
  const palette = isDark ? darkStatusColors : statusColors;
  const tone = palette[status as StatusColorKey] ?? palette.CANCELLED;

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[typography.overline, { color: tone.fg }]} numberOfLines={1}>
        {label ?? humanise(status)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
});
