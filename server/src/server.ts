import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { connectDatabase, disconnectDatabase } from './lib/prisma';
import { disconnectRedis, startRedisKeepAlive, warmRedis } from './lib/redis';
import { closeQueues } from './queues/queues';

let server: Server | undefined;
/** Guards against a second signal arriving mid-shutdown. */
let shuttingDown = false;

const start = async (): Promise<void> => {
  // Both connections are established and warmed BEFORE the port opens, so the
  // first real request never pays the cold-start cost.
  await Promise.all([connectDatabase(), warmRedis()]);
  startRedisKeepAlive();

  const app = createApp();

  server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, url: `http://localhost:${env.PORT}` },
      'BinMan API listening',
    );
  });
};

/**
 * Graceful shutdown: stop accepting new connections, let in-flight requests
 * finish, then release the database, Redis and queue connections. A hard kill
 * mid-request could leave a payment half-applied.
 */
const shutdown = async (signal: string): Promise<void> => {
  // `tsx watch` sends SIGTERM on every reload, and a second signal while the
  // first shutdown is in flight would double-close everything.
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'shutting down');

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    // `listening` is the guard: closing a server that never started, or has
    // already closed, throws ERR_SERVER_NOT_RUNNING and turns an ordinary
    // reload into a scary-looking error.
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await closeQueues();
    await disconnectRedis();
    await disconnectDatabase();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  // Pino only serialises an Error when it is under the `err` key — logging it
  // as `reason` produced the useless `reason: {}` lines this replaces.
  logger.error({ err: reason }, 'unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  // The process state is no longer trustworthy after this; exit and let the
  // supervisor restart us.
  logger.fatal({ err }, 'uncaught exception');
  void shutdown('uncaughtException');
});

void start().catch((err) => {
  logger.fatal({ err }, 'failed to start server');
  process.exit(1);
});
