import type { Request, Response } from 'express';
import { BadRequestError } from './errors';

/**
 * The single response envelope every endpoint uses (trsa.md §6).
 *
 *   { "success": true,  "message": "...", "data": {...} }
 *   { "success": false, "message": "...", "error": { "code": "..." } }
 */

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export const ok = <T>(res: Response, data: T, message = 'Success', meta?: Meta) =>
  res.status(200).json({ success: true, message, data, ...(meta ? { meta } : {}) });

export const created = <T>(res: Response, data: T, message = 'Created successfully') =>
  res.status(201).json({ success: true, message, data });

export const noContent = (res: Response) => res.status(204).send();

export const paginated = <T>(res: Response, items: T[], meta: Meta, message = 'Success') =>
  res.status(200).json({ success: true, message, data: items, meta });

/**
 * Express 5 types route params as `string | string[]` because a wildcard can
 * repeat. Our routes only ever declare single-value params, so this narrows
 * once, here, instead of with a cast at every call site.
 */
export const param = (req: Request, name: string): string => {
  const value = req.params[name];
  const single = Array.isArray(value) ? value[0] : value;
  if (!single) throw new BadRequestError(`Missing route parameter: ${name}`, 'MISSING_PARAM');
  return single;
};
