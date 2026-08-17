import { z } from 'zod';
import type { Meta } from './http';

export const MAX_PAGE_SIZE = 100;

/** Reusable query fragment — spread into any list endpoint's schema. */
export const paginationQuery = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(20),
};

export const paginationSchema = z.object(paginationQuery);

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Reads the validated page/limit off a request.
 *
 * Lived as a private copy inside the admin controller; a second list endpoint
 * elsewhere would have made it a third copy, each free to drift on defaults.
 */
export const fromRequest = (req: { query: unknown }): PaginationInput => {
  const query = req.query as { page?: number; limit?: number };
  return { page: query.page ?? 1, limit: query.limit ?? 20 };
};

export const toSkipTake = ({ page, limit }: PaginationInput) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const buildMeta = (total: number, { page, limit }: PaginationInput): Meta => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
  };
};
