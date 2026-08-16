import { get, set, del, keys } from 'idb-keyval';
import { api, ApiError } from './api';

/**
 * Offline action queue.
 *
 * Uyo has plenty of dead spots, and a driver who marks a collection complete
 * behind a building must not lose that action. Every field action is written to
 * IndexedDB first, then flushed to the API — so the UI can advance immediately
 * and the network catches up later.
 *
 * IndexedDB rather than localStorage because proof photos are Blobs, which
 * localStorage cannot hold without base64-inflating them by a third.
 */

export type QueuedAction =
  | {
      kind: 'status';
      assignmentId: string;
      status: 'DRIVER_EN_ROUTE' | 'ARRIVED' | 'COLLECTED' | 'COMPLETED';
      latitude?: number;
      longitude?: number;
    }
  | { kind: 'accept'; assignmentId: string }
  | {
      kind: 'proof';
      assignmentId: string;
      photos: Blob[];
      latitude?: number;
      longitude?: number;
      notes?: string;
    }
  | {
      kind: 'fail';
      assignmentId: string;
      reason: string;
      description?: string;
    };

export interface QueueEntry {
  id: string;
  action: QueuedAction;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

const PREFIX = 'binman.queue.';
const key = (id: string) => `${PREFIX}${id}`;

const newId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const enqueue = async (action: QueuedAction): Promise<QueueEntry> => {
  const entry: QueueEntry = { id: newId(), action, queuedAt: Date.now(), attempts: 0 };
  await set(key(entry.id), entry);
  notify();
  return entry;
};

export const pending = async (): Promise<QueueEntry[]> => {
  const allKeys = await keys();
  const queueKeys = allKeys.filter(
    (k): k is string => typeof k === 'string' && k.startsWith(PREFIX),
  );
  const entries = await Promise.all(queueKeys.map((k) => get<QueueEntry>(k)));
  return entries
    .filter((entry): entry is QueueEntry => Boolean(entry))
    // Oldest first: a status change must reach the server before the proof
    // that depends on it.
    .sort((a, b) => a.queuedAt - b.queuedAt);
};

const send = async (action: QueuedAction): Promise<void> => {
  switch (action.kind) {
    case 'accept':
      await api.post(`/driver/jobs/${action.assignmentId}/accept`);
      return;

    case 'status':
      await api.post(`/driver/jobs/${action.assignmentId}/status`, {
        status: action.status,
        ...(action.latitude !== undefined ? { latitude: action.latitude } : {}),
        ...(action.longitude !== undefined ? { longitude: action.longitude } : {}),
      });
      return;

    case 'fail':
      await api.post(`/driver/jobs/${action.assignmentId}/fail`, {
        reason: action.reason,
        ...(action.description ? { description: action.description } : {}),
      });
      return;

    case 'proof': {
      const form = new FormData();
      action.photos.forEach((photo, index) => {
        form.append('photos', photo, `proof-${index + 1}.jpg`);
      });
      if (action.latitude !== undefined) form.append('latitude', String(action.latitude));
      if (action.longitude !== undefined) form.append('longitude', String(action.longitude));
      if (action.notes) form.append('notes', action.notes);
      await api.upload(`/driver/jobs/${action.assignmentId}/proof`, form);
      return;
    }
  }
};

const MAX_ATTEMPTS = 8;

let flushing = false;

/**
 * Drains the queue in order, stopping at the first genuinely offline failure
 * so ordering is preserved for the next attempt.
 *
 * A 4xx means the server rejected the action on its merits — replaying it will
 * fail identically forever — so those are dropped rather than retried until the
 * attempt ceiling. The one exception is 409, which usually means the action
 * already landed (a duplicate status change), and is equally safe to drop.
 */
export const flush = async (): Promise<{ sent: number; failed: number }> => {
  if (flushing || typeof navigator !== 'undefined' && !navigator.onLine) {
    return { sent: 0, failed: 0 };
  }

  flushing = true;
  let sent = 0;
  let failed = 0;

  try {
    for (const entry of await pending()) {
      try {
        await send(entry.action);
        await del(key(entry.id));
        sent += 1;
      } catch (error) {
        const apiError = error instanceof ApiError ? error : null;

        if (apiError?.isOffline) {
          // Still no signal — stop, keep order, try again on reconnect.
          break;
        }

        const permanent =
          apiError !== null && apiError.status >= 400 && apiError.status < 500;

        if (permanent || entry.attempts + 1 >= MAX_ATTEMPTS) {
          await del(key(entry.id));
          failed += 1;
          continue;
        }

        await set(key(entry.id), {
          ...entry,
          attempts: entry.attempts + 1,
          lastError: apiError?.message ?? 'Unknown error',
        });
        failed += 1;
      }
    }
  } finally {
    flushing = false;
    notify();
  }

  return { sent, failed };
};

// --- Subscription -----------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

const notify = () => listeners.forEach((listener) => listener());

export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Starts the sync loop. Flushes on reconnect, on tab focus, and on a slow
 * interval as a backstop for the case where the browser never fires `online`
 * (common when a phone drifts between a weak cell and Wi-Fi).
 */
export const startSync = (): (() => void) => {
  const run = () => void flush();

  window.addEventListener('online', run);
  window.addEventListener('focus', run);
  const timer = window.setInterval(run, 30_000);

  run();

  return () => {
    window.removeEventListener('online', run);
    window.removeEventListener('focus', run);
    window.clearInterval(timer);
  };
};

// --- Job cache --------------------------------------------------------------

/**
 * Last-known job data, kept so the app is readable without signal.
 *
 * The route for a job is server-rendered on demand, and the API is
 * deliberately never cached by the service worker (a stale job list could send
 * a driver to a reassigned collection). This cache is the middle ground: the
 * driver sees the address and customer they last loaded, clearly marked as
 * possibly out of date, instead of an error page at the kerbside.
 */
const JOBS_KEY = 'binman.jobs.cache';

export interface CachedJobs<T> {
  jobs: T[];
  cachedAt: number;
}

export const cacheJobs = async <T>(jobs: T[]): Promise<void> => {
  await set(JOBS_KEY, { jobs, cachedAt: Date.now() } satisfies CachedJobs<T>);
};

export const readCachedJobs = async <T>(): Promise<CachedJobs<T> | undefined> =>
  get<CachedJobs<T>>(JOBS_KEY);
