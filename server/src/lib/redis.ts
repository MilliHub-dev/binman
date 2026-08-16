import { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Two connections by design:
 *  - `redis` for ordinary commands (cache, OTP cooldowns, rate limiting)
 *  - `queueConnection` for BullMQ, which requires `maxRetriesPerRequest: null`
 *    and blocks on its own connection.
 */

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  connectTimeout: 5_000,
  /**
   * Bounded failure rather than an unbounded wait.
   *
   * By default a command issued while Redis is down sits in the offline queue
   * until the connection returns, stalling the request that holds it — and,
   * through the rate-limit middleware, every request behind it. A command
   * timeout turns that hang into a rejection the caller can degrade on (see
   * `passOnStoreError` in middleware/rateLimit.ts).
   *
   * Set it too low and a hosted Redis fails on every cold command; measured
   * against Upstash from Nigeria, the first call after connect took ~1.5s.
   *
   * The queue itself stays enabled: rate-limit-redis loads a Lua script from
   * its constructor, at import time, and would otherwise throw an unhandled
   * rejection before the process ever serves a request.
   */
  commandTimeout: env.REDIS_COMMAND_TIMEOUT_MS,
  retryStrategy: (times) => Math.min(times * 200, 5000),
});

export const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

for (const [name, client] of [
  ['redis', redis],
  ['queue', queueConnection],
] as const) {
  client.on('error', (err) => logger.error({ err, client: name }, 'redis error'));
  /**
   * `connect` only means the socket opened — it fires before TLS and auth
   * finish, so logging "connected" there claims a working cache that may never
   * arrive. `ready` is the event that actually means commands will work.
   */
  client.on('connect', () => logger.debug({ client: name }, 'redis socket open'));
  client.on('ready', () => logger.info({ client: name }, 'redis ready'));
}

/**
 * Resolves once the connection is usable.
 *
 * Modules that issue a command at import time — rate-limit-redis loads a Lua
 * script from its constructor — otherwise race the initial connect and trip
 * `commandTimeout` before Redis has even answered. Waiting here removes the
 * race without weakening the fail-fast timeout that protects live traffic.
 *
 * Resolves rather than rejects on timeout: the caller then issues its command
 * and fails through the normal path, with the normal error.
 */
let readyPromise: Promise<void> | null = null;

export const whenRedisReady = (timeoutMs = 15_000): Promise<void> => {
  if (redis.status === 'ready') return Promise.resolve();

  // One shared promise for every caller. Attaching a `once('ready')` per call
  // tripped Node's MaxListenersExceededWarning as soon as a handful of rate
  // limiters initialised together.
  readyPromise ??= new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      redis.off('ready', finish);
      readyPromise = null;
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    redis.once('ready', finish);
  });

  return readyPromise;
};

/**
 * Warms the connection before the server accepts traffic.
 *
 * The FIRST command against a hosted Redis is dramatically slower than the
 * rest — TLS handshake, provider cold start, and a cross-region round trip.
 * Measured against Upstash from Nigeria: first PING 1.5–4.8s, every subsequent
 * command ~270ms.
 *
 * Without this, that cold command was whichever request happened to arrive
 * first — usually a sign-in — and it tripped `commandTimeout`, so the very
 * first login of the day failed with a 503 while everything after it worked.
 * Paying the cost at boot means the timeout only ever applies to warm
 * commands, where it has a comfortable margin.
 */
export const warmRedis = async (): Promise<void> => {
  const started = Date.now();
  try {
    await whenRedisReady();
    // Bypasses commandTimeout deliberately: this call is expected to be slow.
    await redis.ping();
    logger.info({ ms: Date.now() - started }, 'redis warmed');
  } catch (err) {
    // Non-fatal. The API still boots; rate-limited routes will fail closed
    // until Redis answers, which is the intended behaviour anyway.
    logger.warn({ err, ms: Date.now() - started }, 'could not warm redis');
  }
};

/**
 * Keeps the connection from going idle.
 *
 * Hosted providers drop idle connections, and the next command then pays the
 * cold cost again. A cheap periodic PING keeps it warm through quiet spells —
 * overnight, or any gap between bookings.
 */
let keepAlive: NodeJS.Timeout | undefined;

export const startRedisKeepAlive = (intervalMs = 60_000): void => {
  keepAlive ??= setInterval(() => {
    redis.ping().catch((err) => logger.debug({ err }, 'redis keepalive failed'));
  }, intervalMs);

  // Must not hold the process open on shutdown.
  keepAlive.unref();
};

export const disconnectRedis = async () => {
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = undefined;
  }
  await Promise.allSettled([redis.quit(), queueConnection.quit()]);
  logger.info('redis disconnected');
};

/** Namespaced keys, so a shared Redis instance stays legible. */
export const keys = {
  otpCooldown: (phone: string) => `otp:cooldown:${phone}`,
  otpAttempts: (phone: string) => `otp:attempts:${phone}`,
  pricingRules: () => 'cache:pricing:rules',
  timeSlots: () => 'cache:timeslots',
  slotCapacity: (date: string, slotId: string) => `capacity:${date}:${slotId}`,
  whatsappDedupe: (messageId: string) => `wa:msg:${messageId}`,
};
