/**
 * Admin API client.
 *
 * Same contract as the driver app: attach the access token, refresh once on a
 * 401, replay. Refreshes are de-duplicated because the server revokes every
 * session when a spent refresh token is replayed — and an admin dashboard fires
 * a lot of parallel queries on load.
 */

export const API_BASE_URL = `${(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
).replace(/\/$/, '')}/api/v1`;

const ACCESS_KEY = 'binman.admin.access';
const REFRESH_KEY = 'binman.admin.refresh';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

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

  get isOffline() {
    return this.status === 0;
  }

  /** True when the operator lacks the role, not the session. */
  get isForbidden() {
    return this.status === 403;
  }
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PageMeta;
  error?: { code: string; details?: unknown };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
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
    // A network blip is not proof the session died.
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
  skipAuth?: boolean;
  /** Returns the paging envelope alongside the rows. */
  withMeta?: boolean;
}

const send = async <T>(
  path: string,
  options: Options,
  token?: string,
): Promise<{ data: T; meta?: PageMeta }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });

    if (response.status === 204) return { data: undefined as T };

    const text = await response.text();
    const payload: Envelope<T> = text
      ? JSON.parse(text)
      : { success: response.ok, data: undefined as T };

    if (!response.ok || payload.success === false) {
      throw new ApiError(
        payload.message ?? 'Something went wrong',
        response.status,
        payload.error?.code ?? 'UNKNOWN',
        payload.error?.details,
      );
    }

    return { data: payload.data, ...(payload.meta ? { meta: payload.meta } : {}) };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new ApiError('The request timed out.', 0, 'TIMEOUT');
    }
    throw new ApiError('Cannot reach the server.', 0, 'OFFLINE');
  } finally {
    clearTimeout(timer);
  }
};

async function request<T>(path: string, options: Options = {}): Promise<{ data: T; meta?: PageMeta }> {
  if (options.skipAuth) return send<T>(path, options);

  const current = tokens.get();

  try {
    return await send<T>(path, options, current?.accessToken);
  } catch (error) {
    const expired =
      error instanceof ApiError && error.status === 401 && error.code !== 'ACCOUNT_SUSPENDED';
    if (!expired) throw error;

    const fresh = await refresh();
    if (!fresh) throw error;
    return send<T>(path, options, fresh);
  }
}

export const api = {
  get: async <T>(path: string) => (await request<T>(path)).data,
  /** For list endpoints, where the paging envelope matters. */
  list: <T>(path: string) => request<T>(path),
  post: async <T>(path: string, body?: unknown, opts?: Options) =>
    (await request<T>(path, { ...opts, method: 'POST', body })).data,
  patch: async <T>(path: string, body?: unknown) =>
    (await request<T>(path, { method: 'PATCH', body })).data,
};

/** Builds a query string, dropping empty values so URLs stay readable. */
export const qs = (params: Record<string, string | number | undefined | null>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
};
