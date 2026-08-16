import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requireUser } from '../../middleware/authenticate';
import { authorize, ROLE_GROUPS } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { created, ok } from '../../lib/http';
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

/** GET /api/v1/reviews/summary — back-office only. */
reviewsRouter.get(
  '/summary',
  authorize(...ROLE_GROUPS.staff),
  async (_req: Request, res: Response) => ok(res, await service.getRatingSummary()),
);
