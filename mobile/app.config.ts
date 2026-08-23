import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The hosted API. Every build — development, preview and production — points
 * here by default.
 */
const DEFAULT_API_URL = 'https://binman-kx0b.onrender.com';

/**
 * Layers environment-specific values over app.json.
 *
 * `EXPO_PUBLIC_API_URL` overrides the default, which is how a developer points
 * a build at a server running on their own machine:
 *
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npx expo start
 *
 * Note that an Android emulator reaches the host machine at 10.0.2.2 and a
 * physical device needs the LAN IP — `localhost` resolves to the handset.
 *
 * This value is read when the Expo CLI starts and baked into the manifest it
 * serves, so changing it means restarting `expo start`, not just reloading.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'BinMan',
  slug: config.slug ?? 'binman',
  extra: {
    ...config.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL,
  },
});
