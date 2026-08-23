import React from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { typography, useStyles, type Colors } from '../theme';

type Variant = keyof typeof typography;
type Tone = 'default' | 'secondary' | 'muted' | 'inverse' | 'brand' | 'danger' | 'success';

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
  children: React.ReactNode;
}

/**
 * Typed wrapper so screens never hand-roll font sizes. Every piece of text in
 * the app picks a variant from the scale in theme/index.ts.
 *
 * Tones are built from the active palette rather than read from a module-scope
 * map. That map was the single most consequential thing to migrate for dark
 * mode: it set the colour of every string in the app, so left static it would
 * have painted near-black type onto every dark surface.
 */
export const Text: React.FC<Props> = ({
  variant = 'body',
  tone = 'default',
  center,
  style,
  children,
  ...rest
}) => {
  const styles = useStyles(makeStyles);
  return (
    <RNText
      style={[typography[variant] as TextStyle, styles[tone], center && styles.center, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
};

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    center: { textAlign: 'center' },
    default: { color: c.text },
    secondary: { color: c.textSecondary },
    muted: { color: c.textMuted },
    inverse: { color: c.textInverse },
    brand: { color: c.brand },
    danger: { color: c.danger },
    success: { color: c.success },
  });
