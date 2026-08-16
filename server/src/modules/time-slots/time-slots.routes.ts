import { Router } from 'express';
import { validate } from '../../middleware/validate';
import * as controller from './time-slots.controller';
import { availabilityQuery } from './time-slots.schema';

export const timeSlotsRouter: Router = Router();

/**
 * Public: the app needs slots and availability before a customer signs in
 * (the booking screen is reachable from onboarding).
 */

/** GET /api/v1/time-slots */
timeSlotsRouter.get('/', controller.list);

/** GET /api/v1/time-slots/availability?date=YYYY-MM-DD&days=7 */
timeSlotsRouter.get('/availability', validate({ query: availabilityQuery }), controller.availability);
