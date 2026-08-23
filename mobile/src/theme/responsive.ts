import { useWindowDimensions, PixelRatio } from 'react-native';

/**
 * Responsive sizing.
 *
 * Nigerian handsets span a wide range — a 320pt Android budget phone through to
 * a 430pt iPhone Pro Max. A layout tuned only for a 390pt reference device
 * clips at the bottom on the small ones and looks sparse on the large ones.
 *
 * These hooks are all driven by `useWindowDimensions`, which re-renders on
 * rotation, split-screen and foldable unfold. Reading `Dimensions.get()` at
 * module scope — the usual shortcut — captures one value at import time and
 * silently goes stale.
 */

/** The width the design was drawn against. */
const BASE_WIDTH = 390;

export type Breakpoint = 'small' | 'medium' | 'large';

export interface Layout {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  /** True on ~5" devices, where vertical space is the binding constraint. */
  isSmall: boolean;
  isLarge: boolean;
  /** Scales a design-pixel value to this screen, clamped so text stays sane. */
  scale: (size: number) => number;
  /** Horizontal page padding for this width. */
  gutter: number;
  /** Cap content width so a tablet does not stretch a form to 1000pt. */
  maxContentWidth: number;
}

export const useLayout = (): Layout => {
  const { width, height } = useWindowDimensions();

  const breakpoint: Breakpoint = width < 360 ? 'small' : width >= 414 ? 'large' : 'medium';

  /**
   * Scale factor is deliberately damped (70% of the raw ratio) and clamped to
   * 0.85–1.15. Linear scaling makes text comically large on a tablet and
   * unreadably small on a compact phone.
   */
  const raw = width / BASE_WIDTH;
  const factor = Math.min(1.15, Math.max(0.85, 1 + (raw - 1) * 0.7));

  return {
    width,
    height,
    breakpoint,
    isSmall: breakpoint === 'small' || height < 700,
    isLarge: breakpoint === 'large',
    // Rounded to the device pixel grid to avoid blurry half-pixel text.
    scale: (size: number) => PixelRatio.roundToNearestPixel(size * factor),
    gutter: width < 360 ? 16 : width >= 414 ? 24 : 20,
    maxContentWidth: 560,
  };
};
