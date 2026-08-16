import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { toPublicUser, type PublicUser } from './user.mapper';
import type { NotificationPreferencesInput, UpdateProfileInput } from './users.schema';

export const getProfile = async (userId: string): Promise<PublicUser> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  return toPublicUser(user);
};

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> => {
  if (input.email) {
    const taken = await prisma.user.findFirst({
      where: { email: input.email, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw new ConflictError('That email address is already in use', 'EMAIL_TAKEN');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.profileImage !== undefined ? { profileImage: input.profileImage } : {}),
    },
  });

  return toPublicUser(user);
};

export const updateNotificationPreferences = async (
  userId: string,
  input: NotificationPreferencesInput,
): Promise<PublicUser> => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.push !== undefined ? { pushEnabled: input.push } : {}),
      ...(input.sms !== undefined ? { smsEnabled: input.sms } : {}),
      ...(input.whatsapp !== undefined ? { whatsappEnabled: input.whatsapp } : {}),
      ...(input.email !== undefined ? { emailEnabled: input.email } : {}),
    },
  });
  return toPublicUser(user);
};

export const setPushToken = async (userId: string, pushToken: string | null): Promise<void> => {
  await prisma.user.update({ where: { id: userId }, data: { pushToken } });
};
