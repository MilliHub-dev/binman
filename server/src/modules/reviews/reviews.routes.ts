import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireUser } from '../../middleware/authenticate';
import { authorize, ROLE_GROUPS } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { created, ok, paginated } from '../../lib/http';
import { fromRequest, paginationQuery } from '../../lib/pagination';
import * as service from './reviews.service';

const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1, 'Rating must be 1–5').max(5, 'Rating must be 1–5'),
  comment: z.string().trim().max(1000).optional(),
  photoUrls: z.array(z.string().url()).max(5).optional(),
});

export const reviewsRouter: Router = Router();

reviewsRouter.use(authenticate);

/** POST /api/v1/reviews */
reviewsRouter.post('/', validate({ body: createReviewSchema }), async (req: Request, res: Response) => {
  const user = requireUser(req);
  const body = req.body as z.infer<typeof createReviewSchema>;
  const review = await service.createReview(user.id, body.bookingId, body);
  return created(res, review, 'Thanks for your feedback');
});

/** GET /api/v1/reviews — the signed-in customer's own reviews. */
reviewsRouter.get('/', async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.listMyReviews(user.id));
});

const listQuery = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  ...paginationQuery,
});

/**
 * GET /api/v1/reviews/all — every review, for the back office.
 *
 * Mounted before `/summary` matters not at all, but the path is `/all` rather
 * than reusing `GET /` because that one is already the customer's own list and
 * silently widening it by role would be a nasty way to leak everyone's reviews.
 */
reviewsRouter.get(
  '/all',
  authorize(...ROLE_GROUPS.staff),
  validate({ query: listQuery }),
  async (req: Request, res: Response) => {
    const filters = req.query as unknown as z.infer<typeof listQuery>;
    const { items, meta } = await service.listReviews(fromRequest(req), filters);
    return paginated(res, items, meta);
  },
);

/** GET /api/v1/reviews/summary — back-office only. */
reviewsRouter.get(
  '/summary',
  authorize(...ROLE_GROUPS.staff),
  async (_req: Request, res: Response) => ok(res, await service.getRatingSummary()),
);
