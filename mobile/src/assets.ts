/**
 * Bundled artwork.
 *
 * Static `require` calls, not template strings — the Metro bundler resolves
 * these at build time and a dynamic path would simply not be packaged.
 */
export const images = {
  logo: require('../img/logo.png'),
  splashIcon: require('../img/spashicon.png'),

  /**
   * Onboarding artwork, ordered to tell the story in ui.md §5–7:
   * what we do -> when we come -> what else we do -> why it matters.
   */
  onboardingCollect: require('../img/onboarding1.png'),
  onboardingSchedule: require('../img/onboarding3.png'),
  onboardingServices: require('../img/onboarding2.png'),
  onboardingPlanet: require('../img/onboarding4.png'),
} as const;
