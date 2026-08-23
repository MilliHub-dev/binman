import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { palette, colors, useLayout, useStyles, type Colors } from '../theme';

interface Props {
  /** Renders on top of the wash. */
  children?: React.ReactNode;
}

/**
 * Ambient brand wash for the sign-in screens.
 *
 * Soft blue and green glows bled off the edges, in the two logo colours. They
 * sit at low opacity because they are atmosphere, not content — the phone field
 * has to stay the brightest, most definite thing on the screen.
 *
 * Radial gradients rather than a flat tint or a linear band: the falloff has no
 * hard edge, so the colour reads as light in the room behind the form rather
 * than as a shape drawn on it.
 */
export const AuthBackground: React.FC<Props> = ({ children }) => {
  const styles = useStyles(makeStyles);
  const { width, height } = useLayout();

  return (
    <View style={styles.root}>
      <Svg
        style={StyleSheet.absoluteFill}
        width={width}
        height={height}
        // Painted decoration only — a screen reader should walk straight past.
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <RadialGradient id="blue" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.blue[400]} stopOpacity={0.42} />
            <Stop offset="0.6" stopColor={palette.blue[300]} stopOpacity={0.14} />
            <Stop offset="1" stopColor={palette.blue[200]} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id="green" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.green[400]} stopOpacity={0.36} />
            <Stop offset="0.6" stopColor={palette.green[300]} stopOpacity={0.12} />
            <Stop offset="1" stopColor={palette.green[200]} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/*
          Each glow is anchored off-canvas so no complete circle is ever visible —
          a centred circle reads as a drawn dot, an edge-bled one reads as light.
        */}
        <Circle cx={width * 0.88} cy={height * 0.02} r={width * 0.62} fill="url(#blue)" />
        <Circle cx={width * 0.06} cy={height * 0.2} r={width * 0.5} fill="url(#green)" />
        <Circle cx={width * 0.95} cy={height * 0.82} r={width * 0.48} fill="url(#green)" />
      </Svg>

      {children}
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
});
