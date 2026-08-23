import Constants from 'expo-constants';
import { getTokens, saveTokens, clearTokens } from '../store/tokenStorage';
import type { ApiEnvelope } from './types';

/**
 * The single HTTP client. Every network call in the app goes through `request`.
 *
 * Its job beyond fetch:
 *  - attach the access token
 *  - refresh ONCE on a 401 and replay the original request
 *  - turn the API's error envelope into a typed ApiError the UI can switch on
 */

/** Matches the default in app.config.ts, for the case where `extra` is absent. */
const FALLBACK_API_URL = 'https://binman-kx0b.onrender.com';

/**
 * Where the API lives.
 *
 * Every build points at the hosted API. `EXPO_PUBLIC_API_URL` overrides it —
 * that is how a developer targets a server on their own machine — and
 * app.config.ts bakes the result into the manifest at CLI startup.
 *
 * Deriving the host from the Metro bundle used to live here as a fallback. It
 * is gone because it can no longer be reached: a URL is always configured now,
 * and a fallback that never runs is worse than none, since it reads as though
 * some other address is still possible.
 */
const resolveApiUrl = (): { url: string; source: string } => {
  const configured = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  return configured
    ? { url: configured, source: 'app config' }
    : { url: FALLBACK_API_URL, source: 'built-in fallback' };
};

const resolved = resolveApiUrl();
const API_URL = resolved.url;

if (__DEV__) {
  // Printed once at startup so a wrong host is obvious before anything fails.
  console.log(`[api] base URL ${API_URL}/api/v1 (via ${resolved.source})`);
}

export const API_BASE_URL = `${API_URL.replace(/\/$/, '')}/api/v1`;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code = 'UNKNOWN',
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** True when retrying might plausibly work — drives "Try again" buttons. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  /** No connection at all, as opposed to a server that answered with an error. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

/**
 * Called when refreshing fails and the session is truly gone. The auth store
 * registers itself here rather than being imported, which would be circular.
 */
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler = () => {};

export const setSessionExpiredHandler = (handler: SessionExpiredHandler): void => {
  onSessionExpired = handler;
};

/**
 * A single in-flight refresh, shared by every request that 401s at once.
 * Without this, six parallel queries on app open would fire six refreshes and
 * five of them would be rejected as token reuse — which the server treats as
 * theft and responds to by revoking every session.
 */
let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      await clearTokens();
      onSessionExpired();
      return null;
    }

    const payload = (await response.json()) as ApiEnvelope<{
      accessToken: string;
      refreshToken: string;
    }>;

    await saveTokens({
      accessToken: payload.data.accessToken,
      refreshToken: payload.data.refreshToken,
    });

    return payload.data.accessToken;
  } catch {
    // A network failure is not proof the session is invalid — keep the tokens
    // and let the caller surface an offline error instead of signing the
    // customer out mid-booking.
    return null;
  }
};

const runRefresh = (): Promise<string | null> => {
  refreshInFlight ??= refreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Endpoints reachable while signed out (OTP, price list). */
  skipAuth?: boolean;
  signal?: AbortSignal;
  /** Multipart uploads pass a FormData body and set no content-type. */
  formData?: FormData;
  timeoutMs?: number;
}

/**
 * Generous because the API is hosted on a plan whose instances sleep when idle.
 * A cold start regularly runs past twenty seconds, and the first person to open
 * the app each morning would otherwise be told the request "took too long" on a
 * server that was simply waking up.
 */
const REQUEST_TIMEOUT_MS = 45_000;

async function send<T>(path: string, options: RequestOptions, accessToken?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  // Honour an externally supplied signal as well as our timeout.
  options.signal?.addEventListener('abort', () => controller.abort());

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.formData ? {} : options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(options.formData
        ? { body: options.formData }
        : options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      signal: controller.signal,
    });

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let payload: ApiEnvelope<T>;
    try {
      payload = text ? JSON.parse(text) : ({ success: response.ok, data: undefined as T });
    } catch {
      throw new ApiError('The server returned an unexpected response', response.status, 'BAD_RESPONSE');
    }

    if (!response.ok || payload.success === false) {
      throw new ApiError(
        payload.message ?? 'Something went wrong',
        response.status,
        payload.error?.code ?? 'UNKNOWN',
        payload.error?.details,
        payload.error?.requestId,
      );
    }

    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new ApiError('That took too long. Please try again.', 0, 'TIMEOUT');
    }

    /**
     * A failed `fetch` cannot tell "no signal" from "nothing is listening at
     * that address", and the customer-facing copy has to assume the former.
     * That makes a misconfigured host look exactly like a flat connection, so
     * the address is logged in development where it is the usual culprit.
     */
    if (__DEV__) {
      console.warn(
        `[api] request to ${API_BASE_URL}${path} failed: ${(error as Error).message}. ` +
          'If the device has a working connection, check that this host is reachable from ' +
          'the device and that the server is running.',
      );
    }

    throw new ApiError("You're offline. Please check your internet connection.", 0, 'OFFLINE');
  } finally {
    clearTimeout(timeout);
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.skipAuth) return send<T>(path, options);

  const tokens = await getTokens();

  try {
    return await send<T>(path, options, tokens?.accessToken);
  } catch (error) {
    // Only an expired/invalid token is worth retrying; a 403 means the account
    // is suspended and refreshing would change nothing.
    const isAuthFailure =
      error instanceof ApiError &&
      error.status === 401 &&
      error.code !== 'ACCOUNT_SUSPENDED';

    if (!isAuthFailure) throw error;

    const refreshed = await runRefresh();
    if (!refreshed) throw error;

    return send<T>(path, options, refreshed);
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', formData, timeoutMs: 60_000 }),
};

/**
 * Fetches a binary endpoint as a data URI, through the same auth path as
 * `request` — including the refresh-once-on-401 retry.
 *
 * `<Image source={{ uri, headers }}>` cannot do this. It sends whatever token
 * it was handed and has no way to refresh, so an image behind authentication
 * loads right after sign-in and then silently fails fifteen minutes later when
 * the access token expires — which is exactly how the map "could not load".
 */
export async function getImageDataUri(path: string): Promise<string> {
  const attempt = (token?: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const tokens = await getTokens();
  let response = await attempt(tokens?.accessToken);

  if (response.status === 401) {
    const refreshed = await runRefresh();
    if (refreshed) response = await attempt(refreshed);
  }

  if (!response.ok) {
    throw new ApiError(
      `Image request failed (${response.status})`,
      response.status,
      'IMAGE_REQUEST_FAILED',
    );
  }

  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image data'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
