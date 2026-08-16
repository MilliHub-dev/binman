'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api';

/**
 * TanStack Query owns all server state here.
 *
 * An operations dashboard is watched for long stretches, so most screens want
 * fresh data without anyone pressing refresh — individual queries set their own
 * `refetchInterval` where that matters (dispatch, live ops).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A 4xx will fail identically on retry; only retry transport errors.
            retry: (failureCount, error) =>
              error instanceof ApiError && error.status >= 400 && error.status < 500
                ? false
                : failureCount < 2,
            staleTime: 15_000,
            refetchOnWindowFocus: true,
          },
          // Never silently retry a write that assigns work or moves money.
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
