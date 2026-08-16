import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { requireUser } from '../../middleware/authenticate';
import { storeImage } from '../../services/storage.service';
import { BadRequestError } from '../../lib/errors';
import * as usersService from './users.service';
import type { NotificationPreferencesInput, UpdateProfileInput } from './users.schema';

export const me = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await usersService.getProfile(user.id));
};

export const updateMe = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const updated = await usersService.updateProfile(user.id, req.body as UpdateProfileInput);
  return ok(res, updated, 'Profile updated');
};

export const updatePreferences = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const updated = await usersService.updateNotificationPreferences(
    user.id,
    req.body as NotificationPreferencesInput,
  );
  return ok(res, updated, 'Notification preferences updated');
};

export const setPushToken = async (req: Request, res: Response) => {
  const user = requireUser(req);
  await usersService.setPushToken(user.id, (req.body as { pushToken: string | null }).pushToken);
  return ok(res, null, 'Push token updated');
};

export const uploadAvatar = async (req: Request, res: Response) => {
  const user = requireUser(req);
  if (!req.file) throw new BadRequestError('An image file is required', 'FILE_REQUIRED');

  const stored = await storeImage(req.file, 'avatars');
  const updated = await usersService.updateProfile(user.id, { profileImage: stored.url });
  return ok(res, updated, 'Profile photo updated');
};
