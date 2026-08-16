import axios, { type AxiosInstance } from 'axios';
import { env } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('sendchamp');

/**
 * Shared Sendchamp transport. SMS and email are separate products on the same
 * account, same base URL and same bearer credential, so they share one client.
 *
 * Auth is `Authorization: Bearer <PUBLIC_KEY>` — Sendchamp's "public key" is
 * the API credential and IS secret despite the name. Never expose it to a
 * client application.
 */
let cached: AxiosInstance | null = null;

export const sendchamp = (): AxiosInstance => {
  if (cached) return cached;
  cached = axios.create({
    baseURL: env.SENDCHAMP_BASE_URL,
    timeout: 20_000,
    headers: {
      Authorization: `Bearer ${env.SENDCHAMP_PUBLIC_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  return cached;
};

export const describeSendchampError = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; errors?: unknown } | undefined;
    if (data?.message) return data.message;
    if (data?.errors) return JSON.stringify(data.errors);
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
};

/**
 * Sendchamp answers 2xx with `{ status: 'success' | 'error', ... }`, so an HTTP
 * 200 alone does not mean the message was accepted.
 */
export const isAccepted = (data: unknown): boolean =>
  typeof data === 'object' && data !== null && (data as { status?: string }).status === 'success';

export const logSendchamp = log;
