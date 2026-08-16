'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that makes the driver app installable and lets
 * the shell open without signal.
 *
 * Registered only in production: in development the cache fights hot reload and
 * produces stale-bundle bugs that look like application errors.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // A failed registration costs offline support, not the app — the
        // IndexedDB queue works either way.
      });
    };

    // Wait for load so registration never competes with first paint.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
