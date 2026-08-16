import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger';

/**
 * Assigns a correlation id to every request, echoes it back on the response,
 * and attaches it to each log line. Support can trace a customer complaint to
 * exact log entries from the id in the error envelope.
 */
export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.get('x-request-id');
  const id = incoming && incoming.length <= 100 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request).requestId ?? randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  // Health checks would otherwise dominate the log volume.
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/health/ready',
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
