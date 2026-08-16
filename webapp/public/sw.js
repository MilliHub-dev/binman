/**
 * BinMan driver service worker.
 *
 * Scope is deliberately narrow. It makes the app shell available offline so a
 * driver can open the PWA with no signal — but it never caches API responses.
 * A stale job list is worse than no job list: a driver could drive to a
 * collection that was reassigned an hour ago.
 *
 * Queued actions are handled by IndexedDB in the page (see lib/offline.ts),
 * not here, so they survive independently of this cache.
 */

const VERSION = 'binman-driver-v1';
const SHELL = ['/driver', '/driver/jobs', '/img/logo.png', '/img/spashicon.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // Individually, so one 404 does not fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache the API — freshness matters more than availability here.
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;

  // Navigations: network first, cache as the fallback so the shell still opens
  // underground or in a basement car park.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/driver'))),
    );
    return;
  }

  // Static assets: cache first, they are content-hashed by Next.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
