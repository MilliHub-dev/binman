/**
 * In-memory stand-in for `src/lib/redis`, aliased in during integration tests.
 *
 * No Redis server is available in CI or on a fresh dev machine, and the parts
 * of the flow Redis touches (OTP cooldown, WhatsApp dedupe, rate-limit store)
 * are all key/value operations that a Map models faithfully enough to test the
 * real code paths.
 */

interface Entry {
  value: string;
  expiresAt: number | null;
}

const store = new Map<string, Entry>();

const live = (key: string): Entry | null => {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry;
};

class FakeRedis {
  async get(key: string): Promise<string | null> {
    return live(key)?.value ?? null;
  }

  /** Supports the `SET key val EX seconds [NX]` form the app uses. */
  async set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null> {
    const flags = args.map((a) => String(a).toUpperCase());
    const exIndex = flags.indexOf('EX');
    const ttl = exIndex >= 0 ? Number(args[exIndex + 1]) : null;

    if (flags.includes('NX') && live(key)) return null;

    store.set(key, {
      value,
      expiresAt: ttl !== null && !Number.isNaN(ttl) ? Date.now() + ttl * 1000 : null,
    });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) if (store.delete(key)) removed += 1;
    return removed;
  }

  async ttl(key: string): Promise<number> {
    const entry = live(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  /**
   * rate-limit-redis speaks raw commands through here. It loads a Lua script at
   * construction and expects a SHA back, then EVALSHAs it. Tests skip the
   * limiter itself (NODE_ENV=test), so these only have to be shaped correctly —
   * returning the wrong type makes the store reject with "unexpected reply".
   */
  async call(command: string, ...args: unknown[]): Promise<unknown> {
    const cmd = String(command).toLowerCase();

    if (cmd === 'script' && String(args[0]).toLowerCase() === 'load') {
      // Any 40-char hex string satisfies the store's SHA check.
      return '0'.repeat(40);
    }
    if (cmd === 'evalsha' || cmd === 'eval') {
      // [totalHits, timeToExpire] — one hit, a full window remaining.
      return [1, 60_000];
    }
    return null;
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  on(): this {
    return this;
  }
}

export const redis = new FakeRedis() as unknown as import('ioredis').Redis;
export const queueConnection = new FakeRedis() as unknown as import('ioredis').Redis;

export const disconnectRedis = async (): Promise<void> => {
  store.clear();
};

export const keys = {
  otpCooldown: (phone: string) => `otp:cooldown:${phone}`,
  otpAttempts: (phone: string) => `otp:attempts:${phone}`,
  pricingRules: () => 'cache:pricing:rules',
  timeSlots: () => 'cache:timeslots',
  slotCapacity: (date: string, slotId: string) => `capacity:${date}:${slotId}`,
  whatsappDedupe: (messageId: string) => `wa:msg:${messageId}`,
};

/** Lets a test clear cooldowns between OTP requests. */
export const __resetRedis = (): void => store.clear();
