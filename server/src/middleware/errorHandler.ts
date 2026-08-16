import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { MulterError } from 'multer';
import { AppError } from '../lib/errors';
import { isProduction } from '../config/env';
import { logger } from '../lib/logger';

interface Normalised {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * ioredis reports connection trouble through several unrelated error shapes,
 * none of which subclass a common type — so this matches on the messages it
 * actually produces.
 */
const REDIS_SIGNATURES = [
  'Command timed out',
  'Connection is closed',
  'Stream isn\'t writeable',
  'max retries per request',
  'ECONNREFUSED',
  'ETIMEDOUT',
];

/**
 * Prisma codes that mean "the database is unreachable or gave up", as opposed
 * to "your query was wrong". Serverless Postgres (Neon and friends) produces
 * these routinely when a pooled connection is dropped or the compute suspends.
 */
const DB_CONNECTION_CODES = new Set([
  'P1000', // authentication failed
  'P1001', // can't reach database server
  'P1002', // database server timed out
  'P1008', // operation timed out
  'P1017', // server closed the connection
]);

const isRedisFailure = (err: Error): boolean => {
  const haystack = `${err.name} ${err.message}`;
  return REDIS_SIGNATURES.some((signature) => haystack.includes(signature));
};

/** Maps every error the app can raise onto the standard error envelope. */
const normalise = (err: unknown): Normalised => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message, details: err.details };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    };
  }

  if (err instanceof TokenExpiredError) {
    return { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'Your session has expired. Please sign in again.' };
  }
  if (err instanceof JsonWebTokenError) {
    return { statusCode: 401, code: 'TOKEN_INVALID', message: 'Invalid authentication token' };
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : `Upload failed: ${err.message}`;
    return { statusCode: 400, code: `UPLOAD_${err.code}`, message };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return {
          statusCode: 409,
          code: 'DUPLICATE_RESOURCE',
          message: `A record with this ${target} already exists`,
        };
      }
      case 'P2025':
        return { statusCode: 404, code: 'NOT_FOUND', message: 'The requested record was not found' };
      case 'P2003':
        return {
          statusCode: 400,
          code: 'INVALID_REFERENCE',
          message: 'Referenced record does not exist',
        };
      default:
        /**
         * Connection-class failures are infrastructure, not a malformed
         * request. Returning 400 for "cannot reach the database" tells the
         * caller they did something wrong and, worse, tells every client
         * library not to retry — when retrying is exactly the right response.
         */
        if (DB_CONNECTION_CODES.has(err.code)) {
          return {
            statusCode: 503,
            code: 'DATABASE_UNAVAILABLE',
            message: 'Service temporarily unavailable. Please try again shortly.',
          };
        }
        return { statusCode: 400, code: `DB_${err.code}`, message: 'Database request failed' };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: 400, code: 'DB_VALIDATION_ERROR', message: 'Invalid database query' };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return { statusCode: 503, code: 'DATABASE_UNAVAILABLE', message: 'Service temporarily unavailable' };
  }

  // Body-parser surfaces malformed JSON as a SyntaxError with a `body` prop.
  if (err instanceof SyntaxError && 'body' in err) {
    return { statusCode: 400, code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' };
  }

  /**
   * Redis being unreachable is infrastructure, not a bug in the request.
   *
   * It reaches here from any path that fails closed — most importantly the OTP
   * rate limiter, which deliberately refuses to issue codes without a working
   * throttle. Reporting that as a 500 "unexpected error" sends whoever is on
   * call hunting through application code instead of checking Redis.
   */
  if (err instanceof Error && isRedisFailure(err)) {
    return {
      statusCode: 503,
      code: 'CACHE_UNAVAILABLE',
      message: 'Service temporarily unavailable. Please try again shortly.',
    };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express identifies error handlers by arity.
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const { statusCode, code, message, details } = normalise(err);

  const context = {
    err,
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    statusCode,
    code,
  };

  if (statusCode >= 500) {
    logger.error(context, 'request failed');
  } else {
    logger.warn(context, 'request rejected');
  }

  // Never leak internals of an unexpected failure to the client.
  const clientMessage = statusCode >= 500 && isProduction ? 'An unexpected error occurred' : message;

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    error: {
      code,
      ...(details ? { details } : {}),
      ...(req.requestId ? { requestId: req.requestId } : {}),
      ...(!isProduction && err instanceof Error && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  });
};
