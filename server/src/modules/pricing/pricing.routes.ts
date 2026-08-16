import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { optionalAuthenticate } from '../../middleware/authenticate';
import * as controller from './pricing.controller';
import { priceListQuery, quoteSchema } from './pricing.schema';

export const pricingRouter: Router = Router();

/** GET /api/v1/pricing — public price list. */
pricingRouter.get('/', validate({ query: priceListQuery }), controller.list);

/**
 * POST /api/v1/pricing/quote
 * Auth is optional so the app can show a price during onboarding, but an
 * addressId can only be resolved for the signed-in owner.
 */
pricingRouter.post('/quote', optionalAuthenticate, validate({ body: quoteSchema }), controller.quote);
