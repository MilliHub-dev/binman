import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme';
import { ApiError } from './src/api/client';

/**
 * Query defaults tuned for a mobile network in Nigeria: retry a couple of
 * times on a flaky connection, but never retry a request the server has
 * already rejected on its merits (a 4xx will fail identically every time).
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 60_000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // A failed booking or payment must surface immediately, not silently
      // retry and risk creating two of something.
      retry: false,
    },
  },
});

// React Query's window-focus refetching has no meaning on mobile; wire it to
// the app returning to the foreground instead.
AppState.addEventListener('change', (state: AppStateStatus) => {
  focusManager.setFocused(state === 'active');
});

/**
 * Inside the provider, so the status bar can follow the theme. Dark text on a
 * dark ground is invisible, and it is the one piece of chrome the app does not
 * draw itself.
 */
const Themed: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Themed />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
