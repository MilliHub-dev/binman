import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests: real Express app, real HTTP, real Postgres.
 *
 * Redis, BullMQ and Flutterwave are aliased to fakes — no Redis server exists
 * on a fresh machine, and the Flutterwave keys in .env are LIVE, so a test must
 * never be able to reach them.
 *
 *   npm run test:integration
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^.*\/lib\/redis$/, replacement: resolve(__dirname, 'tests/integration/fakes/redis.ts') },
      { find: /^.*\/queues\/queues$/, replacement: resolve(__dirname, 'tests/integration/fakes/queues.ts') },
      {
        find: /^.*\/services\/flutterwave\.service$/,
        replacement: resolve(__dirname, 'tests/integration/fakes/flutterwave.ts'),
      },
      {
        find: /^.*\/services\/whatsapp\.service$/,
        replacement: resolve(__dirname, 'tests/integration/fakes/whatsapp.ts'),
      },
    ],
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    // The whole suite shares one database and one seeded dataset, so files must
    // not race each other.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 60_000,
    hookTimeout: 120_000,
    globalSetup: resolve(__dirname, 'tests/integration/global-setup.ts'),
  },
});
