import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { strictLimiter } from '../../middleware/rateLimit';
import * as controller from './bookings.controller';
import {
  bookingIdParam,
  cancelBookingSchema,
  createBookingSchema,
  listBookingsQuery,
  rescheduleBookingSchema,
} from './bookings.schema';

export const bookingsRouter: Router = Router();

bookingsRouter.use(authenticate);

/** POST /api/v1/bookings */
bookingsRouter.post('/', strictLimiter, validate({ body: createBookingSchema }), controller.create);

/** GET /api/v1/bookings?scope=upcoming|active|completed */
bookingsRouter.get('/', validate({ query: listBookingsQuery }), controller.list);

/** GET /api/v1/bookings/reference/:reference — the WhatsApp "track" lookup. */
bookingsRouter.get('/reference/:reference', controller.byReference);

/** GET /api/v1/bookings/:id */
bookingsRouter.get('/:id', validate({ params: bookingIdParam }), controller.detail);

/** GET /api/v1/bookings/:id/timeline */
bookingsRouter.get('/:id/timeline', validate({ params: bookingIdParam }), controller.timeline);

/** POST /api/v1/bookings/:id/cancel */
bookingsRouter.post(
  '/:id/cancel',
  validate({ params: bookingIdParam, body: cancelBookingSchema }),
  controller.cancel,
);

/** POST /api/v1/bookings/:id/reschedule */
bookingsRouter.post(
  '/:id/reschedule',
  validate({ params: bookingIdParam, body: rescheduleBookingSchema }),
  controller.reschedule,
);
