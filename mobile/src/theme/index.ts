import { Platform, TextStyle } from 'react-native';

export { colors, lightColors, darkColors, palette, statusColors, darkStatusColors, gradients } from './colors';
export type { StatusColorKey, Colors } from './colors';
export { ThemeProvider, useTheme } from './ThemeProvider';
export type { ThemePreference } from './ThemeProvider';
export { useStyles } from './useStyles';
export { useLayout } from './responsive';
export type { Layout, Breakpoint } from './responsive';

/** 4pt grid. Every margin and padding in the app comes from here. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/**
 * ui.md §2 suggests Inter / Plus Jakarta Sans / Manrope. The system font is
 * used until the brand font is licensed and bundled — it is the fastest to
 * render and never causes a layout shift on first paint.
 */
const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const typography = {
  /** Screen titles — "What's your phone number?" */
  h1: { fontFamily, fontSize: 28, lineHeight: 34, fontWeight: weight.bold, letterSpacing: -0.4 },
  h2: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: weight.bold, letterSpacing: -0.3 },
  h3: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: weight.semibold, letterSpacing: -0.2 },
  /** Card titles and list rows. */
  bodyLarge: { fontFamily, fontSize: 16, lineHeight: 24, fontWeight: weight.regular },
  body: { fontFamily, fontSize: 15, lineHeight: 22, fontWeight: weight.regular },
  bodyMedium: { fontFamily, fontSize: 15, lineHeight: 22, fontWeight: weight.medium },
  caption: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: weight.regular },
  /** Status badges and eyebrow labels. */
  overline: {
    fontFamily,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: weight.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  button: { fontFamily, fontSize: 16, lineHeight: 20, fontWeight: weight.semibold },
} satisfies Record<string, TextStyle>;

/**
 * Shadows are deliberately soft. A card should lift off the background, not
 * announce itself.
 */
export const shadow = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 1 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }),
} as const;

/** Minimum tappable height — below this, thumbs miss. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TAP_TARGET = 44;
