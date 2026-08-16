import { PrismaClient } from '@prisma/client';
import { isDevelopment } from '../config/env';
import { logger } from './logger';

/**
 * A single client for the process. In dev, `tsx watch` re-imports modules on
 * every save, so the instance is cached on globalThis to avoid exhausting the
 * Postgres connection pool with orphaned clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
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

if (isDevelopment) {
  globalForPrisma.prisma = prisma;

  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    // Only surface slow queries; a full query log drowns everything else out.
    if (e.duration >= 200) {
      logger.debug({ query: e.query, duration: e.duration }, 'slow query');
    }
  });
}

prisma.$on('warn' as never, (e: { message: string }) => logger.warn({ prisma: e.message }));
prisma.$on('error' as never, (e: { message: string }) => logger.error({ prisma: e.message }));

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
