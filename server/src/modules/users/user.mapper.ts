import type { Role, User, UserStatus } from '@prisma/client';

/**
 * The only shape of a user that ever leaves the API. Mapping explicitly (rather
 * than spreading the record) means a column added to the schema can never leak
 * into a response by accident.
 */
export interface PublicUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  profileImage: string | null;
  profileComplete: boolean;
  notificationPreferences: {
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    email: boolean;
  };
  createdAt: Date;
}

export const toPublicUser = (user: User): PublicUser => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: fullName.length > 0 ? fullName : null,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    profileImage: user.profileImage,
    profileComplete: Boolean(user.firstName && user.lastName),
    notificationPreferences: {
      push: user.pushEnabled,
      sms: user.smsEnabled,
      whatsapp: user.whatsappEnabled,
      email: user.emailEnabled,
    },
    createdAt: user.createdAt,
  };
};

/** Compact form embedded in bookings, dispatch lists and driver job details. */
export interface UserSummary {
  id: string;
  fullName: string | null;
  phone: string;
}

export const toUserSummary = (
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'phone'>,
): UserSummary => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return {
    id: user.id,
    fullName: fullName.length > 0 ? fullName : null,
    phone: user.phone,
  };
};
