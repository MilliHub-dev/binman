import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing, useStyles, type Colors } from '../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  /** Draws the selected state used by every option list in the booking flow. */
  selected?: boolean;
  disabled?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Card: React.FC<Props> = ({
  children,
  onPress,
  selected = false,
  disabled = false,
  padded = true,
  style,
  testID,
}) => {
  const styles = useStyles(makeStyles);
  const content = (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        selected && styles.selected,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => pressed && !disabled && styles.pressed}
    >
      {content}
    </Pressable>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: c.border,
    ...(shadow.sm as object),
  },
  padded: { padding: spacing.base },
  // Selection reads through both border and fill, so it survives greyscale.
  selected: { borderColor: c.brand, backgroundColor: c.brandSubtle },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
});
