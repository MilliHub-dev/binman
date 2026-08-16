import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './addresses.controller';
import { addressIdParam, createAddressSchema, updateAddressSchema } from './addresses.schema';

export const addressesRouter: Router = Router();

addressesRouter.use(authenticate);

/** GET /api/v1/addresses */
addressesRouter.get('/', controller.list);

/** POST /api/v1/addresses */
addressesRouter.post('/', validate({ body: createAddressSchema }), controller.create);

/** PATCH /api/v1/addresses/:id */
addressesRouter.patch(
  '/:id',
  validate({ params: addressIdParam, body: updateAddressSchema }),
  controller.update,
);

/** DELETE /api/v1/addresses/:id */
addressesRouter.delete('/:id', validate({ params: addressIdParam }), controller.remove);

/** POST /api/v1/addresses/:id/default */
addressesRouter.post('/:id/default', validate({ params: addressIdParam }), controller.setDefault);
