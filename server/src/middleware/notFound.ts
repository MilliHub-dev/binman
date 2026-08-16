import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../lib/errors';

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};
