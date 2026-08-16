import type { NextFunction, Request, Response } from 'express';
import { UserStatus } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../modules/auth/token.service';

const bearer = (req: Request): string | null => {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};

/**
 * Verifies the access token and loads the current user.
 *
 * The DB read on every request is deliberate: a suspended account or a role
 * change must take effect immediately, not whenever the 15-minute token
 * happens to expire.
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = bearer(req);
    if (!token) throw new UnauthorizedError('Authentication required', 'TOKEN_MISSING');

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        driver: { select: { id: true } },
      },
    });

    if (!user) throw new UnauthorizedError('Account no longer exists', 'USER_NOT_FOUND');

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Please contact support.', 'ACCOUNT_SUSPENDED');
    }
    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedError('Account no longer exists', 'USER_NOT_FOUND');
    }

    req.user = {
      id: user.id,
      phone: user.phone,
      role: user.role,
      ...(user.driver ? { driverId: user.driver.id } : {}),
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Attaches the user when a valid token is present, but never rejects.
 * For endpoints whose response varies for signed-in customers.
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!bearer(req)) {
    next();
    return;
  }
  await authenticate(req, res, (err?: unknown) => next(err instanceof Error ? undefined : err));
};

/** Narrowing helper — use after `authenticate` to satisfy the type checker. */
export const requireUser = (req: Request): Express.AuthenticatedUser => {
  if (!req.user) throw new UnauthorizedError('Authentication required', 'TOKEN_MISSING');
  return req.user;
};
