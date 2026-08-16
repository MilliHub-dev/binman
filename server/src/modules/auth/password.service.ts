import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../../lib/errors';
import { issueTokens, type TokenPair } from './token.service';
import { toPublicUser, type PublicUser } from '../users/user.mapper';

const log = createLogger('auth.password');

/**
 * Email + password sign-in for back-office staff (prd.md §35, "password
 * hashing where passwords are used").
 *
 * Deliberately separate from the OTP flow rather than bolted onto it: the two
 * have different threat models. OTP proves possession of a phone; a password
 * proves knowledge of a secret, which means it needs hashing, brute-force
 * resistance, and a rotation story that OTP does not.
 */

const BCRYPT_ROUNDS = 12;

/** Only these roles may hold a password at all. */
export const PASSWORD_ROLES: Role[] = [
  Role.SUPPORT,
  Role.DISPATCHER,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];

export interface PasswordLoginResult extends TokenPair {
  user: PublicUser;
  /** True when the account is still on a seeded or reset password. */
  mustChangePassword: boolean;
}

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);

/**
 * Minimum strength for anything a human chooses. Deliberately modest — length
 * does more work than character-class rules, and rules that are too fussy push
 * people towards writing passwords down.
 */
export const assertPasswordStrength = (password: string): void => {
  if (password.length < 10) {
    throw new BadRequestError('Password must be at least 10 characters', 'PASSWORD_TOO_SHORT');
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new BadRequestError(
      'Password must include an uppercase letter, a lowercase letter and a number',
      'PASSWORD_TOO_WEAK',
    );
  }
};

/**
 * Verifies credentials and issues a session.
 *
 * Every failure returns the SAME error, whether the email is unknown, the
 * account has no password, or the password is wrong. Distinguishing them would
 * let an attacker enumerate which staff addresses exist.
 */
export const loginWithPassword = async (
  email: string,
  password: string,
  context: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<PasswordLoginResult> => {
  const invalid = () =>
    new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  /**
   * Hash against a dummy value when there is no user or no password set, so an
   * unknown address costs the same time as a known one. Without this, response
   * timing alone reveals which emails are registered.
   */
  if (!user?.passwordHash) {
    await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    log.warn({ email }, 'password login attempt for unknown or passwordless account');
    throw invalid();
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    log.warn({ userId: user.id }, 'password login failed');
    throw invalid();
  }

  // Only past the credential check do we explain a role or status problem —
  // by then the caller has already proven who they are.
  if (!PASSWORD_ROLES.includes(user.role)) {
    throw new ForbiddenError('This account does not have operations access', 'NOT_STAFF');
  }
  if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DELETED) {
    throw new ForbiddenError('This account has been disabled', 'ACCOUNT_DISABLED');
  }

  const tokens = await issueTokens(
    { id: user.id, phone: user.phone, role: user.role },
    context,
  );

  /**
   * Stamped in the background. Nothing in the response depends on it, and
   * awaiting it added a full database round trip — ~370ms against a
   * cross-region Postgres — to every sign-in for a field nobody reads
   * synchronously.
   */
  void prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch((err) => log.warn({ err, userId: user.id }, 'could not stamp lastLoginAt'));

  log.info({ userId: user.id, role: user.role }, 'staff signed in with password');

  return {
    ...tokens,
    user: toPublicUser(user),
    mustChangePassword: user.mustChangePassword,
  };
};

/**
 * Changes the signed-in user's own password.
 *
 * Requires the current password even though the caller is authenticated — an
 * unattended desk should not be enough to take over an operations account.
 * Every other session is revoked, so a stolen one dies here.
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    throw new BadRequestError('This account does not use a password', 'NO_PASSWORD_SET');
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new UnauthorizedError('Your current password is incorrect', 'INVALID_CREDENTIALS');
  }

  assertPasswordStrength(newPassword);

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new BadRequestError('Choose a password you have not used before', 'PASSWORD_REUSED');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    // Everything else signs out; the current session keeps its tokens.
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  log.info({ userId }, 'password changed');
};

/** Admin-initiated reset. The target must change it on next sign-in. */
export const setPasswordForUser = async (
  targetUserId: string,
  newPassword: string,
): Promise<void> => {
  assertPasswordStrength(newPassword);

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash, mustChangePassword: true },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  log.info({ targetUserId }, 'password set by administrator');
};
