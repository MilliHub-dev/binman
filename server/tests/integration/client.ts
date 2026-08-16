import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app';

/**
 * A tiny HTTP client for the integration suite.
 *
 * Requests go over a real socket to a real Express instance — middleware,
 * validation, auth and the error handler all run exactly as they do in
 * production, which is the whole point of testing at this level rather than
 * calling services directly.
 */

export interface ApiResponse<T = any> {
  status: number;
  body: {
    success: boolean;
    message?: string;
    data?: T;
    meta?: Record<string, unknown>;
    error?: { code: string; details?: unknown };
  };
}

let server: Server | undefined;
let baseUrl = '';

export const startServer = async (): Promise<string> => {
  if (server) return baseUrl;
  const app = createApp();
  await new Promise<void>((resolve) => {
    // Port 0 lets the OS pick a free port, so parallel runs cannot collide.
    server = app.listen(0, () => resolve());
  });
  const { port } = server!.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
  return baseUrl;
};

export const stopServer = async (): Promise<void> => {
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server!.close((err) => (err ? reject(err) : resolve())),
  );
  server = undefined;
};

interface RequestOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

const request = async (
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse> => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await res.text();
  let body: ApiResponse['body'];
  try {
    body = text ? JSON.parse(text) : { success: res.ok };
  } catch {
    // A non-JSON body (a CSV export, say) still needs to be assertable.
    body = { success: res.ok, data: text as never };
  }

  return { status: res.status, body };
};

export const api = {
  get: (path: string, token?: string) => request('GET', path, token ? { token } : {}),
  post: (path: string, body?: unknown, token?: string) =>
    request('POST', path, { ...(body !== undefined ? { body } : {}), ...(token ? { token } : {}) }),
  patch: (path: string, body?: unknown, token?: string) =>
    request('PATCH', path, { ...(body !== undefined ? { body } : {}), ...(token ? { token } : {}) }),
  put: (path: string, body?: unknown, token?: string) =>
    request('PUT', path, { ...(body !== undefined ? { body } : {}), ...(token ? { token } : {}) }),
  delete: (path: string, token?: string) => request('DELETE', path, token ? { token } : {}),
  raw: request,
};

/**
 * Polls until `check` returns a truthy value.
 *
 * Notifications are dispatched fire-and-forget so a provider can never slow the
 * payment path (`void notifications.notify...`). That means the row appears
 * shortly AFTER the HTTP response, and asserting on it immediately is a race —
 * this waits for the effect instead of guessing at a sleep duration.
 */
export const waitFor = async <T>(
  check: () => Promise<T | null | undefined>,
  { timeoutMs = 10_000, intervalMs = 250, label = 'condition' } = {},
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  let last: T | null | undefined;

  while (Date.now() < deadline) {
    last = await check();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
};

/**
 * Registers (or signs in) a phone number and returns its access token.
 * Relies on OTP_DEBUG_RETURN, which global-setup forces on.
 */
export const signIn = async (phone: string): Promise<{ token: string; userId: string }> => {
  const requested = await api.post('/api/v1/auth/request-otp', { phone });
  const code = requested.body.data?.debugCode;
  if (!code) {
    throw new Error(
      `No debugCode returned for ${phone} (status ${requested.status}): ${JSON.stringify(requested.body)}`,
    );
  }

  const verified = await api.post('/api/v1/auth/verify-otp', { phone, otp: code });
  if (!verified.body.data?.accessToken) {
    throw new Error(`Sign-in failed for ${phone}: ${JSON.stringify(verified.body)}`);
  }

  return { token: verified.body.data.accessToken, userId: verified.body.data.user.id };
};
