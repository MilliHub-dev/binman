import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { uploadSingleImage } from '../../middleware/upload';
import * as controller from './users.controller';
import {
  notificationPreferencesSchema,
  pushTokenSchema,
  updateProfileSchema,
} from './users.schema';

export const usersRouter: Router = Router();

usersRouter.use(authenticate);

/** GET /api/v1/users/me */
usersRouter.get('/me', controller.me);

/** PATCH /api/v1/users/me */
usersRouter.patch('/me', validate({ body: updateProfileSchema }), controller.updateMe);

/** PATCH /api/v1/users/me/notification-preferences */
usersRouter.patch(
  '/me/notification-preferences',
  validate({ body: notificationPreferencesSchema }),
  controller.updatePreferences,
);

/** PUT /api/v1/users/me/push-token */
usersRouter.put('/me/push-token', validate({ body: pushTokenSchema }), controller.setPushToken);

/** POST /api/v1/users/me/avatar — multipart, field name `image`. */
usersRouter.post('/me/avatar', uploadSingleImage, controller.uploadAvatar);
