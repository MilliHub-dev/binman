/**
 * BinMan palette, sampled from the brand logo.
 *
 * The mark is two-tone: azure blue (#189CF0) on "Bin", yellow-green (#84C024)
 * on "Man". Blue leads — it is what the in-app mockups use for the selected
 * state (see img/onboarding3.png) — and green carries the environmental accents:
 * recycling, success, completion.
 */

const blue = {
  50: '#E8F5FE',
  100: '#C7E8FC',
  200: '#93D3F9',
  300: '#5BBBF5',
  400: '#2FA8F2',
  500: '#189CF0',
  600: '#0C84E4',
  700: '#0A6BBC',
  800: '#0A5695',
  900: '#0C3F6B',
} as const;

/**
 * Sampled at #8CC832 across the logo and onboarding artwork — a fresh, light
 * green rather than an olive one. The ramp is built around that as the 500.
 */
const green = {
  50: '#F4FBE8',
  100: '#E6F6CC',
  200: '#D0ED9F',
  300: '#B5E169',
  400: '#9DD744',
  500: '#8CC832',
  600: '#74AC26',
  700: '#5A871E',
  800: '#456818',
  900: '#334D13',
} as const;

const grey = {
  0: '#FFFFFF',
  25: '#FCFDFE',
  50: '#F7FAFC',
  100: '#EFF4F8',
  200: '#E3EAF1',
  300: '#CBD6E2',
  400: '#94A6B8',
  500: '#66798C',
  600: '#4A5C6E',
  700: '#33475B',
  800: '#1D2E40',
  900: '#0F1E2E',
} as const;

export const palette = {
  blue,
  green,
  grey,
  amber: { 50: '#FFF8E6', 100: '#FFECBF', 500: '#F5A623', 700: '#A96908' },
  red: { 50: '#FEF2F2', 100: '#FDE1E1', 500: '#E5484D', 700: '#A81F24' },
} as const;

export const lightColors = {
  /** Primary action. */
  brand: blue[500],
  brandPressed: blue[600],
  brandSubtle: blue[50],
  brandBorder: blue[200],

  /** Environmental accent — recycling, completion, "on the way". */
  accent: green[500],
  accentPressed: green[600],
  accentSubtle: green[50],

  background: grey[50],
  surface: grey[0],
  surfaceSubtle: grey[100],

  border: grey[200],
  borderStrong: grey[300],

  text: grey[900],
  textSecondary: grey[600],
  textMuted: grey[500],
  textInverse: grey[0],
  textDisabled: grey[400],

  success: green[600],
  successSubtle: green[50],
  warning: palette.amber[500],
  warningSubtle: palette.amber[50],
  danger: palette.red[500],
  dangerSubtle: palette.red[50],
  info: blue[500],
  infoSubtle: blue[50],

  overlay: 'rgba(15, 30, 46, 0.55)',
  skeleton: grey[200],
} as const;

/**
 * Night palette.
 *
 * Not an inversion of the light set. Two things break when you simply flip:
 * the brand blue (#189CF0) loses contrast against a dark ground, and pure
 * black surfaces make the elevation shadows the app relies on invisible. So
 * the brand steps one rung lighter, and surfaces are layered greys with a blue
 * bias rather than black — the same hue family as the light theme's neutrals,
 * which is what keeps the two feeling like one product.
 */
/**
 * `lightColors` is `as const`, so each of its values types as its own literal.
 * Widening to string here is what lets a second palette satisfy the same shape
 * while still failing the build if it omits or misspells a token.
 */
export type Colors = { [K in keyof typeof lightColors]: string };

export const darkColors: Colors = {
  brand: blue[400],
  brandPressed: blue[300],
  brandSubtle: '#0E2A3F',
  brandBorder: '#1C4B6B',

  accent: green[400],
  accentPressed: green[300],
  accentSubtle: '#1A2C11',

  background: '#0A121B',
  surface: '#121E2B',
  surfaceSubtle: '#1A2735',

  border: '#223140',
  borderStrong: '#31424F',

  text: '#EAF1F7',
  textSecondary: '#A7BACB',
  textMuted: '#7C90A3',
  /** Sits on brand/accent fills, which stay light enough to need dark type. */
  textInverse: '#08121C',
  textDisabled: '#596B7C',

  success: green[400],
  successSubtle: '#16290F',
  warning: palette.amber[500],
  warningSubtle: '#33260A',
  danger: '#FF6369',
  dangerSubtle: '#3A1416',
  info: blue[400],
  infoSubtle: '#0E2A3F',

  overlay: 'rgba(0, 0, 0, 0.65)',
  skeleton: '#1E2C3A',
};

/**
 * Default export kept as the light set so a module that has not been migrated
 * to `useTheme()` still compiles and renders. Anything reading this directly is
 * light-only by definition.
 */
export const colors = lightColors;

/**
 * Gradients carry both brand colours at once, which is what makes the app read
 * as BinMan rather than "a blue app". Blue→green runs the length of the logo,
 * so the hero mirrors the mark.
 *
 * Tuples are `as const` because expo-linear-gradient types `colors` as a
 * readonly tuple of at least two values.
 */
export const gradients = {
  /** Home hero and other full-bleed brand surfaces. */
  brand: [blue[500], blue[600], green[600]] as const,
  /** Softer variant for cards sitting on white. */
  brandSoft: [blue[400], green[500]] as const,
  /** Success moments — payment confirmed, pickup completed. */
  success: [green[400], green[600]] as const,
  /** Barely-there tint behind empty states. */
  wash: [blue[50], green[50]] as const,
} as const;

/**
 * Booking statuses. Keys mirror the server's BookingStatus enum exactly, so a
 * new status surfaces as a type error here rather than an unstyled badge.
 *
 * Blue = in progress with us; green = the job is physically happening or done.
 */
export const statusColors = {
  PENDING_PAYMENT: { bg: palette.amber[50], fg: palette.amber[700] },
  PAID: { bg: blue[50], fg: blue[700] },
  PENDING_ASSIGNMENT: { bg: blue[50], fg: blue[700] },
  ASSIGNED: { bg: blue[50], fg: blue[700] },
  DRIVER_EN_ROUTE: { bg: green[50], fg: green[700] },
  ARRIVED: { bg: green[50], fg: green[700] },
  COLLECTED: { bg: green[50], fg: green[700] },
  COMPLETED: { bg: green[50], fg: green[700] },
  CANCELLED: { bg: grey[100], fg: grey[600] },
  FAILED: { bg: palette.red[50], fg: palette.red[700] },
} as const;

/**
 * The same statuses on a dark ground.
 *
 * Not the light tints reused: a pale amber pill glows against a dark surface
 * and drags the eye away from the content it is labelling. Each pair is a deep
 * tint with light type, so a badge reads as a quiet label in both themes.
 */
export const darkStatusColors: Record<keyof typeof statusColors, { bg: string; fg: string }> = {
  PENDING_PAYMENT: { bg: '#3A2C0B', fg: '#FFD27A' },
  PAID: { bg: '#0E2A3F', fg: blue[300] },
  PENDING_ASSIGNMENT: { bg: '#0E2A3F', fg: blue[300] },
  ASSIGNED: { bg: '#0E2A3F', fg: blue[300] },
  DRIVER_EN_ROUTE: { bg: '#16290F', fg: green[300] },
  ARRIVED: { bg: '#16290F', fg: green[300] },
  COLLECTED: { bg: '#16290F', fg: green[300] },
  COMPLETED: { bg: '#16290F', fg: green[300] },
  CANCELLED: { bg: '#1E2C3A', fg: grey[400] },
  FAILED: { bg: '#3A1416', fg: '#FF9EA1' },
};

export type StatusColorKey = keyof typeof statusColors;
