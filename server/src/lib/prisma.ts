import { Prisma, PrismaClient } from '@prisma/client';
import { isDevelopment } from '../config/env';
import { logger } from './logger';

/**
 * Operations that only read. Replaying one of these can waste time but cannot
 * change anything, which is what makes them safe to retry after an ambiguous
 * failure.
 */
const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * The query provably never reached the database: the client could not connect,
 * or never got a connection out of the pool. Replaying is safe for writes too.
 */
const NEVER_EXECUTED_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timed out during connect
  'P2024', // Timed out fetching a connection from the pool
]);

/**
 * The connection died while the query was in flight. Whether the statement
 * committed is genuinely unknowable from here, so only reads are replayed.
 */
const CONNECTION_LOST_CODES = new Set(['P1017']);

const CONNECTION_LOST_SIGNATURES = [
  'Server has closed the connection',
  'kind: Closed',
  'Connection reset by peer',
  'connection closed',
];

type Verdict = 'never-executed' | 'in-flight' | 'permanent';

const classify = (error: unknown): Verdict => {
  /**
   * An initialization error means the engine never established a connection,
   * so nothing was sent and any operation is safe to replay.
   *
   * Deliberately not keyed on `errorCode`: for the ordinary "Can't reach
   * database server" case that property is `undefined` rather than 'P1001',
   * and keying on it made this whole extension a no-op.
   */
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'never-executed';
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (NEVER_EXECUTED_CODES.has(error.code)) return 'never-executed';
    if (CONNECTION_LOST_CODES.has(error.code)) return 'in-flight';
    return 'permanent';
  }

  /**
   * Neon drops idle connections and the engine surfaces that as an unknown
   * request error rather than a coded one — "Error in PostgreSQL connection:
   * Error { kind: Closed, cause: None }". Matching on the text is unpleasant
   * but it is the only signal the engine gives.
   */
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return CONNECTION_LOST_SIGNATURES.some((s) => error.message.includes(s))
      ? 'in-flight'
      : 'permanent';
  }

  return 'permanent';
};

const MAX_ATTEMPTS = 3;

const backoffMs = (attempt: number): number =>
  // Short, with jitter: a woken Neon compute answers in well under a second,
  // and every retry is a customer waiting on a request.
  attempt * 150 + Math.floor(Math.random() * 100);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries queries that failed because the connection was stale.
 *
 * Serverless Postgres closes idle connections underneath a pool that still
 * believes they are good, so the next query on one of them fails through no
 * fault of the caller. Reconnecting at boot — which `connectDatabase` already
 * does — cannot help hours later, when the failure lands mid-request and the
 * customer sees a 503.
 *
 * A write is only replayed when the error proves it never executed. Retrying a
 * write that may have committed is how one booking becomes two.
 */
const retryOnDeadConnections = Prisma.defineExtension({
  name: 'retryOnDeadConnections',
  query: {
    async $allOperations({ operation, args, query }) {
      let lastError: unknown;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          return await query(args);
        } catch (error) {
          lastError = error;

          const verdict = classify(error);
          const replayable =
            verdict === 'never-executed' ||
            (verdict === 'in-flight' && READ_OPERATIONS.has(operation));

          if (!replayable || attempt === MAX_ATTEMPTS) throw error;

          const waitMs = backoffMs(attempt);
          logger.warn(
            { operation, attempt, waitMs, verdict, err: error },
            'database connection lost — retrying query',
          );
          await sleep(waitMs);
        }
      }

      throw lastError;
    },
  },
});

/**
 * A single client for the process. In dev, `tsx watch` re-imports modules on
 * every save, so the instance is cached on globalThis to avoid exhausting the
 * Postgres connection pool with orphaned clients.
 */
const createClient = () => {
  const client = new PrismaClient({
    log: isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });

  // `$on` is unavailable on an extended client, so listeners attach first.
  if (isDevelopment) {
    client.$on('query' as never, (e: { query: string; duration: number }) => {
      // Only surface slow queries; a full query log drowns everything else out.
      if (e.duration >= 200) {
        logger.debug({ query: e.query, duration: e.duration }, 'slow query');
      }
    });
  }

  client.$on('warn' as never, (e: { message: string }) => logger.warn({ prisma: e.message }));
  client.$on('error' as never, (e: { message: string }) => logger.error({ prisma: e.message }));

  return client.$extends(retryOnDeadConnections);
};

type ExtendedPrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma: ExtendedPrismaClient = globalForPrisma.prisma ?? createClient();

if (isDevelopment) globalForPrisma.prisma = prisma;

/**
 * Connects, retrying with backoff.
 *
 * Serverless Postgres (Neon, and the equivalents) suspends its compute when
 * idle and takes several seconds to wake. A single connect attempt means the
 * API refuses to boot whenever the database happens to be cold — which in
 * development is most mornings, and in production is any deploy that lands
 * during a quiet spell.
 */
export const connectDatabase = async (attempts = 5): Promise<void> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      logger.info({ attempt }, 'database connected');
      return;
    } catch (err) {
      if (attempt === attempts) {
        logger.fatal({ err, attempts }, 'database unreachable after retries');
        throw err;
      }
      const waitMs = attempt * 2000;
      logger.warn({ attempt, waitMs }, 'database not ready — retrying');
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
};

export const disconnectDatabase = async () => {
  await prisma.$disconnect();
  logger.info('database disconnected');
};

/** Transaction settings tuned for the booking flow's read-then-write races. */
export const TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 15000,
} as const;
