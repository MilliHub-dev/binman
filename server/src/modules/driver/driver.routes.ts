import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { uploadProofPhotos } from '../../middleware/upload';
import * as controller from './driver.controller';
import {
  availabilitySchema,
  failJobSchema,
  jobIdParam,
  jobsQuery,
  locationPingSchema,
  updateJobStatusSchema,
} from './driver.schema';

export const driverRouter: Router = Router();

// Every route here is for field staff only. Cleaners share the job endpoints
// once cleaning assignments go live.
driverRouter.use(authenticate, authorize(Role.DRIVER, Role.CLEANER, Role.ADMIN, Role.SUPER_ADMIN));

/** GET /api/v1/driver/home */
driverRouter.get('/home', controller.home);

/** GET /api/v1/driver/jobs?scope=today */
driverRouter.get('/jobs', validate({ query: jobsQuery }), controller.listJobs);

/** GET /api/v1/driver/jobs/:id */
driverRouter.get('/jobs/:id', validate({ params: jobIdParam }), controller.getJob);

/** POST /api/v1/driver/jobs/:id/accept */
driverRouter.post('/jobs/:id/accept', validate({ params: jobIdParam }), controller.accept);

/** POST /api/v1/driver/jobs/:id/status */
driverRouter.post(
  '/jobs/:id/status',
  validate({ params: jobIdParam, body: updateJobStatusSchema }),
  controller.updateStatus,
);

/**
 * POST /api/v1/driver/jobs/:id/proof — multipart, field name `photos`.
 * Body validation happens in the controller, after multer parses the form.
 */
driverRouter.post(
  '/jobs/:id/proof',
  validate({ params: jobIdParam }),
  uploadProofPhotos,
  controller.submitProof,
);

/** POST /api/v1/driver/jobs/:id/fail */
driverRouter.post(
  '/jobs/:id/fail',
  validate({ params: jobIdParam, body: failJobSchema }),
  controller.failJob,
);

/** POST /api/v1/driver/location */
driverRouter.post('/location', validate({ body: locationPingSchema }), controller.ping);

/** PATCH /api/v1/driver/availability */
driverRouter.patch('/availability', validate({ body: availabilitySchema }), controller.setAvailability);
