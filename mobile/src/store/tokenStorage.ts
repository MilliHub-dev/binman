import * as SecureStore from 'expo-secure-store';

/**
 * Tokens live in the device keychain / Android keystore, never in AsyncStorage.
 * A refresh token is a long-lived credential; plain storage would expose it to
 * any process that can read the app's sandbox on a rooted device.
 */

const ACCESS_KEY = 'binman.accessToken';
const REFRESH_KEY = 'binman.refreshToken';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Cached in memory so the hot path (attaching a token to a request) does not
 * hit the keychain on every call — that is a native round trip.
 */
let cache: StoredTokens | null = null;
let loaded = false;

export const getTokens = async (): Promise<StoredTokens | null> => {
  if (loaded) return cache;

  try {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    cache = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  } catch {
    cache = null;
  }

  loaded = true;
  return cache;
};

export const saveTokens = async (tokens: StoredTokens): Promise<void> => {
  cache = tokens;
  loaded = true;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
};

export const clearTokens = async (): Promise<void> => {
  cache = null;
  loaded = true;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
};
