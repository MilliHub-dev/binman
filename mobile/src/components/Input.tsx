import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { radius, spacing, typography, useStyles, type Colors, useTheme } from '../theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Rendered inside the field, e.g. the +234 country prefix. */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input: React.FC<Props> = ({
  label,
  error,
  hint,
  prefix,
  suffix,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text variant="bodyMedium" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          // Error styling wins over focus — the problem is what matters.
          Boolean(error) && styles.fieldError,
        ]}
      >
        {prefix ? <View style={styles.prefix}>{prefix}</View> : null}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textDisabled}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityLabel={label}
          {...rest}
        />
        {suffix ? <View style={styles.suffix}>{suffix}</View> : null}
      </View>

      {error ? (
        <Text variant="caption" tone="danger" style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  wrapper: { marginBottom: spacing.base },
  label: { marginBottom: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    minHeight: 52,
  },
  fieldFocused: { borderColor: c.brand },
  fieldError: { borderColor: c.danger },
  input: {
    flex: 1,
    ...typography.bodyLarge,
    color: c.text,
    paddingVertical: spacing.md,
  },
  prefix: { marginRight: spacing.sm },
  suffix: { marginLeft: spacing.sm },
  helper: { marginTop: spacing.xs },
});
