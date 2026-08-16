'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { pending, startSync, subscribe, type QueueEntry } from '@/lib/offline';

/**
 * Persistent connection status.
 *
 * A driver needs to know two things at a glance: whether they have signal, and
 * whether anything they did is still waiting to reach us. Hiding a queue would
 * mean they finish a shift believing everything synced.
 */
/** Browser connectivity, read through React's external-store API. */
const subscribeToConnectivity = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

export function OfflineBar() {
  const online = useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    // Assume online during SSR so the bar never flashes on first paint.
    () => true,
  );
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  useEffect(() => {
    const refresh = () => void pending().then(setQueue);

    const unsubscribe = subscribe(refresh);
    const stopSync = startSync();
    refresh();

    return () => {
      unsubscribe();
      stopSync();
    };
  }, []);

  if (online && queue.length === 0) return null;

  const offline = !online;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-50 px-4 py-2 text-center text-sm font-semibold ${
        offline ? 'bg-warn-bg text-[#8a5200]' : 'bg-brand-50 text-brand-800'
      }`}
    >
      {offline ? (
        <>
          <span aria-hidden="true">📴</span> No signal — your work is saved and will sync
          {queue.length > 0 ? ` (${queue.length} waiting)` : ''}
        </>
      ) : (
        <>
          <span aria-hidden="true">🔄</span> Syncing {queue.length}{' '}
          {queue.length === 1 ? 'update' : 'updates'}…
        </>
      )}
    </div>
  );
}
