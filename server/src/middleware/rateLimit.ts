import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import { redis, whenRedisReady } from '../lib/redis';
import { isTest } from '../config/env';

/**
 * Rate limiting is backed by Redis so the limits hold across every API
 * instance — a per-process counter is worthless behind a load balancer
 * (trsa.md §35, "API rate limiting").
 */
const store = (prefix: string) =>
  new RedisStore({
    prefix: `rl:${prefix}:`,
    /**
     * The store loads its Lua script from the constructor, which runs at import
     * time — before the connection is up. Awaiting readiness first is what
     * stops that turning into a burst of unhandled rejections at boot.
     */
    sendCommand: (async (...args: string[]) => {
      await whenRedisReady();
      return redis.call(...(args as [string, ...string[]]));
    }) as unknown as (...args: string[]) => Promise<never>,
  });

const base = (prefix: string, options: Partial<Options>) =>
  rateLimit({
    windowMs: 60_000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: store(prefix),
    // If Redis is unreachable, serve the request rather than failing it. A
    // cache outage should degrade rate limiting, not take the whole API down.
    // The OTP limiters below override this — see the note there.
    passOnStoreError: true,
    // Limits would make the test suite flaky and slow.
    skip: () => isTest,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
      error: { code: 'RATE_LIMITED' },
    },
    ...options,
  });

/** Broad protection on everything under /api. */
export const globalLimiter = base('global', {
  windowMs: 60_000,
  limit: 300,
});

/**
 * OTP request throttle, keyed by phone number rather than IP: several
 * customers legitimately share one mobile network NAT address, but one phone
 * number should not be able to trigger an SMS flood.
 */
export const otpRequestLimiter = base('otp-request', {
  windowMs: 15 * 60_000,
  limit: 5,
  keyGenerator: (req: Request) => String(req.body?.phone ?? req.ip ?? 'unknown'),
  // Unlike the others, these two FAIL CLOSED. Serving OTP traffic with no
  // limiter would let a Redis outage become an SMS-bill attack or an
  // unthrottled brute-force window against a 6-digit code.
  passOnStoreError: false,
  message: {
    success: false,
    message: 'Too many verification codes requested. Please wait before trying again.',
    error: { code: 'OTP_RATE_LIMITED' },
  },
});

/** Guards against brute-forcing a 6-digit code. Fails closed — see above. */
export const otpVerifyLimiter = base('otp-verify', {
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req: Request) => String(req.body?.phone ?? req.ip ?? 'unknown'),
  passOnStoreError: false,
});

/**
 * Password sign-in. Keyed by email so one attacker cannot lock out a whole
 * office by hammering from a shared NAT address, and FAILS CLOSED — an
 * unthrottled password endpoint is a brute-force target.
 */
export const passwordLoginLimiter = base('password-login', {
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req: Request) =>
    String(req.body?.email ?? req.ip ?? 'unknown').toLowerCase(),
  passOnStoreError: false,
  message: {
    success: false,
    message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
    error: { code: 'LOGIN_RATE_LIMITED' },
  },
});

/** Writes that create money movement or dispatch work. */
export const strictLimiter = base('strict', {
  windowMs: 60_000,
  limit: 20,
});

/** Webhooks come from provider infrastructure; the ceiling is a safety net. */
export const webhookLimiter = base('webhook', {
  windowMs: 60_000,
  limit: 600,
});
