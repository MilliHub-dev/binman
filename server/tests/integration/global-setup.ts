// vitest does not load .env for us, and this runs before any app module.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Points the whole run at a dedicated `binman_test` Postgres schema and brings
 * it to a known-empty state.
 *
 * Isolation is the point: integration tests create customers, take bookings and
 * move money-shaped state around. None of that may touch the development data
 * in `public`.
 *
 * Deliberately does NOT use `prisma db push --force-reset`: that resets the
 * whole datasource, which would destroy `public` too. Instead the schema is
 * created explicitly and its tables truncated by name — an operation that
 * cannot reach outside `binman_test`.
 */

const TEST_SCHEMA = 'binman_test';

const testDatabaseUrl = (): string => {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL is required to run integration tests');

  const url = new URL(base);
  url.searchParams.set('schema', TEST_SCHEMA);

  /**
   * Prisma defaults to `cpus * 2 + 1` connections, which on a developer machine
   * is around 17. Serverless Postgres poolers drop connections well before
   * that under a sustained run, which surfaced as tests failing at random
   * points with P1001 rather than at a consistent one.
   *
   * A small pool with a generous checkout timeout is the right shape here: the
   * suite is sequential, so it never needs more than a couple of connections,
   * and waiting briefly for one beats having it torn away mid-query.
   */
  url.searchParams.set('connection_limit', '5');
  url.searchParams.set('pool_timeout', '30');

  return url.toString();
};

/**
 * Neon suspends its compute when idle and takes several seconds to wake. The
 * Prisma CLI gives up sooner than that, so the first connection is made — and
 * retried — from a client we control, before any CLI command runs.
 */
const wakeDatabase = async (url: string, attempts = 5): Promise<void> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      await prisma.$queryRaw`SELECT 1`;
      // The schema must exist before `db push` targets it.
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    } finally {
      await prisma.$disconnect();
    }
  }
};

/** Empties every table in the test schema, in one statement, FK-order-free. */
const truncateTestSchema = async (url: string): Promise<number> => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = ${TEST_SCHEMA}
    `;
    if (tables.length === 0) return 0;

    const list = tables.map((t) => `"${TEST_SCHEMA}"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    return tables.length;
  } finally {
    await prisma.$disconnect();
  }
};

export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();

  // Every child process below, and the test workers, must agree on this.
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  // Rate limiters short-circuit under NODE_ENV=test; this keeps OTP codes in
  // the response so a test can complete a login.
  process.env.OTP_DEBUG_RETURN = 'true';
  // Request logs would bury the test report. Override to see them.
  process.env.LOG_LEVEL ??= 'silent';

  const env = { ...process.env, DATABASE_URL: url };

  console.log(`\n  integration DB: schema "${TEST_SCHEMA}" (isolated from public)`);

  await wakeDatabase(url);

  // Creates any missing tables. Non-destructive: on an already-matching schema
  // it is a no-op.
  execSync('npx prisma db push --skip-generate', { env, stdio: 'pipe' });

  const cleared = await truncateTestSchema(url);
  console.log(`  cleared ${cleared} tables`);

  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });
  console.log('  seeded\n');
}
