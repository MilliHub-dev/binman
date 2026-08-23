import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type Colors } from './colors';

/**
 * Light and dark, plus following the phone.
 *
 * "system" is the default because a customer who has set their handset to dark
 * has already told us what they want; making them say it twice is the app not
 * listening.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'binman.theme';

interface ThemeValue {
  colors: Colors;
  /** What is actually on screen right now, after resolving "system". */
  scheme: 'light' | 'dark';
  isDark: boolean;
  /** What the customer chose, which may be "system". */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  scheme: 'light',
  isDark: false,
  preference: 'system',
  setPreference: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Restored asynchronously; the first frame uses "system", which is the right
  // guess for anyone who has not chosen, and correct again as soon as it lands.
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    // Fire and forget: nothing on screen waits for the write.
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeValue>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      isDark: scheme === 'dark',
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeValue => useContext(ThemeContext);
