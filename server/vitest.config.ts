import { defineConfig } from 'vitest/config';

/**
 * Unit tests: pure logic, no database, no network. Fast enough to run on every
 * save.
 *
 * The integration suite is excluded here — it needs a live Postgres, provider
 * fakes and a global setup, all of which live in vitest.integration.config.ts.
 * Run it with `npm run test:integration`.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', 'node_modules/**', 'dist/**'],
  },
});
