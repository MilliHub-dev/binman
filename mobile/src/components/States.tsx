import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { radius, spacing, useStyles, type Colors, useTheme } from '../theme';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { ApiError } from '../api/client';

/**
 * Loading, empty and error states (ui.md §39–41).
 *
 * "Do not display blank screens" — every list and detail screen uses these
 * rather than rendering nothing while it waits.
 */

export const LoadingState: React.FC<{ label?: string }> = ({ label }) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
  <View style={styles.centered}>
    <ActivityIndicator size="large" color={colors.brand} />
    {label ? (
      <Text tone="secondary" center style={styles.spaced}>
        {label}
      </Text>
    ) : null}
  </View>
);
};

interface ErrorProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

/** Turns an ApiError into copy a customer can act on. */
const describe = (error: unknown): { title: string; message: string; retryable: boolean } => {
  if (error instanceof ApiError) {
    if (error.isOffline) {
      return {
        title: "You're offline",
        message: 'Please check your internet connection and try again.',
        retryable: true,
      };
    }
    return {
      title: 'Something went wrong',
      message: error.message,
      retryable: error.isRetryable,
    };
  }
  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    retryable: true,
  };
};

export const ErrorState: React.FC<ErrorProps> = ({ error, onRetry, title }) => {
  const styles = useStyles(makeStyles);
  const described = describe(error);
  return (
    <View style={styles.centered}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>!</Text>
      </View>
      <Text variant="h3" center style={styles.spaced}>
        {title ?? described.title}
      </Text>
      <Text tone="secondary" center style={styles.message}>
        {described.message}
      </Text>
      {onRetry && described.retryable ? (
        <Button label="Try Again" variant="secondary" fullWidth={false} onPress={onRetry} />
      ) : null}
    </View>
  );
};

interface EmptyProps {
  /** A drawn icon rather than an emoji — see the note in Icon.tsx. */
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyProps> = ({
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
  <View style={styles.centered}>
    <View style={styles.emptyIcon}>
      <Icon name={icon} size={26} color={colors.textMuted} />
    </View>
    <Text variant="h3" center style={styles.spaced}>
      {title}
    </Text>
    {message ? (
      <Text tone="secondary" center style={styles.message}>
        {message}
      </Text>
    ) : null}
    {actionLabel && onAction ? (
      <Button label={actionLabel} fullWidth={false} onPress={onAction} />
    ) : null}
  </View>
);
};

/** Grey blocks that stand in for content while it loads. */
export const Skeleton: React.FC<{ height?: number; width?: number | string; style?: object }> = ({
  height = 16,
  width = '100%',
  style,
}) => {
  const styles = useStyles(makeStyles);
  return <View style={[styles.skeleton, { height, width: width as number }, style]} />;
};

export const BookingCardSkeleton: React.FC = () => {
  const styles = useStyles(makeStyles);
  return (
  <View style={styles.skeletonCard}>
    <Skeleton height={12} width="35%" />
    <Skeleton height={20} width="60%" style={{ marginTop: spacing.md }} />
    <Skeleton height={14} width="45%" style={{ marginTop: spacing.sm }} />
    <Skeleton height={32} width="100%" style={{ marginTop: spacing.base }} />
  </View>
);
};

const makeStyles = (c: Colors) => StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: 260,
  },
  spaced: { marginTop: spacing.base },
  message: { marginTop: spacing.sm, marginBottom: spacing.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 26, fontWeight: '700', color: c.danger },
  skeleton: {
    backgroundColor: c.skeleton,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  skeletonCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
});
