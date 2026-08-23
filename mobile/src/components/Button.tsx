import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, typography, MIN_TAP_TARGET, useStyles, type Colors, useTheme } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The primary action must always be the most prominent thing on screen
 * (ui.md §1). Only one `primary` button per screen.
 *
 * While loading, the label stays mounted and is hidden behind the spinner so
 * the button does not change width mid-press.
 */
export const Button: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles[`${variant}Pressed` as const],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' || variant === 'danger' ? colors.textInverse : colors.brand}
            style={StyleSheet.absoluteFill}
          />
        )}
        {icon && !loading ? <View style={styles.icon}>{icon}</View> : null}
        <Text
          style={[
            typography.button,
            styles[`${variant}Label` as const],
            isDisabled && styles.disabledLabel,
            loading && styles.hiddenLabel,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP_TARGET,
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: spacing.sm },

  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.base },
  lg: { paddingVertical: spacing.base, paddingHorizontal: spacing.lg },

  primary: { backgroundColor: c.brand },
  primaryPressed: { backgroundColor: c.brandPressed },
  primaryLabel: { color: c.textInverse },

  secondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  secondaryPressed: { backgroundColor: c.surfaceSubtle },
  secondaryLabel: { color: c.text },

  ghost: { backgroundColor: 'transparent' },
  ghostPressed: { backgroundColor: c.surfaceSubtle },
  ghostLabel: { color: c.brand },

  danger: { backgroundColor: c.danger },
  dangerPressed: { opacity: 0.85 },
  dangerLabel: { color: c.textInverse },

  disabled: { opacity: 0.45 },
  disabledLabel: {},
  // Kept in the layout so the button does not resize while loading.
  hiddenLabel: { opacity: 0 },
});
