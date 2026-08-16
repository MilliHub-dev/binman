import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { join } from 'node:path';
import { env, isProduction } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { httpLogger, requestContext } from './middleware/requestContext';
import { globalLimiter } from './middleware/rateLimit';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

export const createApp = (): Express => {
  const app = express();

  // Behind a load balancer / reverse proxy, so req.ip and rate limiting see the
  // real client address rather than the proxy's.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser callers (mobile app, WhatsApp, curl) send no Origin.
        if (!origin) return callback(null, true);
        if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);

        /**
         * Deny by omitting the header, rather than throwing.
         *
         * Throwing here surfaces as a 500 with no CORS headers, so the browser
         * reports a confusing "no Access-Control-Allow-Origin" while the server
         * logs an internal error — and neither says which origin was refused.
         * `false` is a clean denial, and the warning names the origin so a
         * missing entry in CORS_ORIGINS is obvious from the logs.
         */
        logger.warn(
          { origin, allowed: env.CORS_ORIGINS },
          'blocked cross-origin request — add the origin to CORS_ORIGINS if this is one of ours',
        );
        return callback(null, false);
      },
      credentials: true,
      exposedHeaders: ['x-request-id'],
    }),
  );

  app.use(compression());
  app.use(requestContext);
  app.use(httpLogger);

  /**
   * Webhook signature verification needs the exact bytes Meta signed, so the
   * raw body is captured before JSON parsing. Applied globally because the
   * verify hook is the only place the raw buffer is still available.
   */
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Locally stored proof photos and avatars. In production these live in
  // object storage behind a CDN instead (trsa.md §17).
  if (env.STORAGE_DRIVER === 'local') {
    app.use('/uploads', express.static(join(process.cwd(), env.STORAGE_LOCAL_DIR), { maxAge: '7d' }));
  }

  /** Liveness — is the process up? */
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ success: true, status: 'ok', uptime: process.uptime() });
  });

  /** Readiness — can it actually serve traffic? */
  app.get('/health/ready', async (_req: Request, res: Response) => {
    const [database, cache] = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);

    const checks = {
      database: database.status === 'fulfilled',
      redis: cache.status === 'fulfilled',
    };
    const ready = Object.values(checks).every(Boolean);

    res.status(ready ? 200 : 503).json({ success: ready, status: ready ? 'ready' : 'degraded', checks });
  });

  app.use('/api', globalLimiter);
  app.use('/api/v1', apiRouter);

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'BinMan API',
      data: { version: 'v1', docs: '/api/v1', environment: isProduction ? 'production' : env.NODE_ENV },
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
