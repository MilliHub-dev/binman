import { createHash, randomBytes } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { UnauthorizedError } from '../../lib/errors';
import { dayjs } from '../../lib/datetime';

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: Role;
}

interface IssueContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Refresh tokens are opaque random strings, not JWTs. They are stored as
 * SHA-256 digests so a database leak cannot be replayed against the API, and
 * they rotate on every use.
 */
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: 'binman-api',
    audience: 'binman-clients',
  } as SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'binman-api',
    audience: 'binman-clients',
  });

  if (typeof decoded === 'string' || !decoded.sub) {
    throw new UnauthorizedError('Invalid authentication token', 'TOKEN_INVALID');
  }

  return {
    sub: String(decoded.sub),
    phone: String((decoded as jwt.JwtPayload).phone ?? ''),
    role: (decoded as jwt.JwtPayload).role as Role,
  };
};

/** Refresh TTL is expressed the same way as the JWT TTL, e.g. '30d'. */
const refreshExpiry = (): Date => {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_TTL);
  if (!match) return dayjs().add(30, 'day').toDate();
  const [, amount, unit] = match;
  const unitMap = { s: 'second', m: 'minute', h: 'hour', d: 'day' } as const;
  return dayjs()
    .add(Number(amount), unitMap[unit as keyof typeof unitMap])
    .toDate();
};

export const issueTokens = async (
  user: { id: string; phone: string; role: Role },
  context: IssueContext = {},
): Promise<TokenPair> => {
  const accessToken = signAccessToken({ sub: user.id, phone: user.phone, role: user.role });

  const refreshToken = randomBytes(48).toString('base64url');

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      expiresAt: refreshExpiry(),
    },
  });

  return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL };
};

/**
 * Exchanges a refresh token for a new pair, revoking the old one.
 *
 * If a token that was already revoked is presented, that is evidence of theft
 * or replay — every session for that user is killed rather than just refusing
 * the one request.
 */
export const rotateRefreshToken = async (
  token: string,
  context: IssueContext = {},
): Promise<TokenPair> => {
  const tokenHash = hashToken(token);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, phone: true, role: true, status: true } } },
  });

  if (!stored) throw new UnauthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Session revoked. Please sign in again.', 'REFRESH_TOKEN_REUSED');
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError('Session expired. Please sign in again.', 'REFRESH_TOKEN_EXPIRED');
  }

  if (stored.user.status === 'SUSPENDED' || stored.user.status === 'DELETED') {
    throw new UnauthorizedError('Account is not active', 'ACCOUNT_INACTIVE');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(stored.user, context);
};

export const revokeRefreshToken = async (token: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};
