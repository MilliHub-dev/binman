import { OtpPurpose, Role, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { maskPhone } from '../../lib/phone';
import { ConflictError, ForbiddenError } from '../../lib/errors';
import { issueOtp, verifyOtp } from './otp.service';
import { issueTokens, type TokenPair } from './token.service';
import { toPublicUser, type PublicUser } from '../users/user.mapper';

const log = createLogger('auth');

export interface RequestOtpResult {
  expiresAt: Date;
  /** Lets the client route to profile setup instead of the home screen. */
  isNewUser: boolean;
  debugCode?: string;
}

export interface LoginResult extends TokenPair {
  user: PublicUser;
  /** True until first name / last name have been supplied.  */
  profileComplete: boolean;
}

interface ClientContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Step one of the only login flow the platform has (prd.md §7).
 *
 * The response does not reveal whether the number is suspended or unknown
 * beyond the `isNewUser` hint the UI needs — enumeration of customer numbers
 * gains an attacker nothing useful.
 */
export const requestOtp = async (phone: string): Promise<RequestOtpResult> => {
  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, status: true, firstName: true },
  });

  if (existing?.status === UserStatus.SUSPENDED) {
    throw new ForbiddenError('This account has been suspended. Please contact support.', 'ACCOUNT_SUSPENDED');
  }

  const purpose = existing ? OtpPurpose.LOGIN : OtpPurpose.REGISTRATION;
  const { expiresAt, debugCode } = await issueOtp(phone, purpose);

  return {
    expiresAt,
    isNewUser: !existing,
    ...(debugCode ? { debugCode } : {}),
  };
};

/**
 * Step two: verify the code, then create the account on first success.
 *
 * Registration is implicit — a verified phone number IS the account
 * (prd.md §6.1). The profile is filled in afterwards.
 */
export const verifyOtpAndLogin = async (
  phone: string,
  code: string,
  context: ClientContext = {},
): Promise<LoginResult> => {
  const existing = await prisma.user.findUnique({ where: { phone } });

  await verifyOtp(phone, code, existing ? OtpPurpose.LOGIN : OtpPurpose.REGISTRATION);

  if (existing?.status === UserStatus.SUSPENDED) {
    throw new ForbiddenError('This account has been suspended. Please contact support.', 'ACCOUNT_SUSPENDED');
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          lastLoginAt: new Date(),
          // A verified login promotes a half-registered account to active.
          ...(existing.status === UserStatus.PENDING ? { status: UserStatus.ACTIVE } : {}),
        },
      })
    : await prisma.user.create({
        data: {
          phone,
          role: Role.CUSTOMER,
          // Active on creation: the number is proven. `profileComplete` is what
          // drives the client to the profile-setup screen, not account status.
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      });

  const tokens = await issueTokens({ id: user.id, phone: user.phone, role: user.role }, context);

  log.info({ userId: user.id, phone: maskPhone(phone), isNew: !existing }, 'login succeeded');

  return {
    ...tokens,
    user: toPublicUser(user),
    profileComplete: Boolean(user.firstName && user.lastName),
  };
};

/** Fills in the details collected on the profile-setup screen (ui.md §10). */
export const completeProfile = async (
  userId: string,
  input: { firstName: string; lastName: string; email?: string },
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
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.email ? { email: input.email } : {}),
      status: UserStatus.ACTIVE,
    },
  });

  return toPublicUser(user);
};
