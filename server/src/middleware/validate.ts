import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from '../lib/errors';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const formatIssues = (error: ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));

/**
 * Parses and REPLACES req.body/query/params with the validated result, so
 * controllers work with typed, coerced, stripped data — an unvalidated field
 * cannot reach a service by accident.
 *
 * Express 5 makes req.query a getter-only property, hence the defineProperty.
 */
export const validate =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      if (schemas.body) req.body = schemas.body.parse(req.body);

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ValidationError('Validation failed', formatIssues(err)));
        return;
      }
      next(err);
    }
  };
