/**
 * Browser-side API client for the driver app.
 *
 * Mirrors the mobile client's contract: attach the access token, refresh once
 * on a 401, replay the original request. Refreshes are de-duplicated because
 * the server revokes every session when a spent refresh token is replayed.
 */

/**
 * Defaults to the hosted API so a driver's phone reaches it from any network.
 * `localhost` only ever worked in a desktop browser on the same machine as the
 * server, which is not where this app is used.
 */
export const API_BASE_URL = `${(
  process.env.NEXT_PUBLIC_API_URL ?? 'https://binman-kx0b.onrender.com'
).replace(/\/$/, '')}/api/v1`;

const ACCESS_KEY = 'binman.driver.access';
const REFRESH_KEY = 'binman.driver.refresh';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * localStorage, not a cookie: the driver app is a client-rendered PWA that
 * talks to a separate API origin, so there is no same-site cookie to lean on.
 * The tradeoff is XSS exposure, which is why the app renders no user-supplied
 * HTML anywhere.
 */
export const tokens = {
  get(): Tokens | null {
    if (typeof window === 'undefined') return null;
    const accessToken = localStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  },
  set(value: Tokens) {
    localStorage.setItem(ACCESS_KEY, value.accessToken);
    localStorage.setItem(REFRESH_KEY, value.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'UNKNOWN',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** No connection at all, as opposed to a server that answered. */
  get isOffline() {
    return this.status === 0;
  }
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: { code: string; details?: unknown };
}

let refreshInFlight: Promise<string | null> | null = null;

const doRefresh = async (): Promise<string | null> => {
  const current = tokens.get();
  if (!current) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });

    if (!response.ok) {
      tokens.clear();
      return null;
    }

    const payload: Envelope<Tokens> = await response.json();
    tokens.set(payload.data);
    return payload.data.accessToken;
  } catch {
    // A network failure is not proof the session is invalid — keep the tokens
    // so a driver in a dead spot is not signed out mid-shift.
    return null;
  }
};

const refresh = (): Promise<string | null> => {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  skipAuth?: boolean;
  timeoutMs?: number;
}

const send = async <T>(path: string, options: Options, token?: string): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.form || options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(options.form
        ? { body: options.form }
        : options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      signal: controller.signal,
    });

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const payload: Envelope<T> = text ? JSON.parse(text) : { success: response.ok, data: undefined as T };

    if (!response.ok || payload.success === false) {
      throw new ApiError(
        payload.message ?? 'Something went wrong',
        response.status,
        payload.error?.code ?? 'UNKNOWN',
        payload.error?.details,
      );
    }

    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new ApiError('That took too long. Please try again.', 0, 'TIMEOUT');
    }
    throw new ApiError('You appear to be offline.', 0, 'OFFLINE');
  } finally {
    clearTimeout(timer);
  }
};

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  if (options.skipAuth) return send<T>(path, options);

  const current = tokens.get();

  try {
    return await send<T>(path, options, current?.accessToken);
  } catch (error) {
    const isExpired =
      error instanceof ApiError && error.status === 401 && error.code !== 'ACCOUNT_SUSPENDED';
    if (!isExpired) throw error;

    const fresh = await refresh();
    if (!fresh) throw error;
    return send<T>(path, options, fresh);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, opts?: Options) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', form, timeoutMs: 60_000 }),
};
