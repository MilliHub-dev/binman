import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

/** Role groupings used across the route tables (trsa.md §7). */
export const ROLE_GROUPS = {
  /** Full system configuration. */
  superAdmin: [Role.SUPER_ADMIN],
  /** Anything an operations manager may do. */
  admin: [Role.ADMIN, Role.SUPER_ADMIN],
  /** Dispatch desk: assign work, move bookings along. */
  dispatch: [Role.DISPATCHER, Role.ADMIN, Role.SUPER_ADMIN],
  /** Anyone who works in the back office. */
  staff: [Role.SUPPORT, Role.DISPATCHER, Role.ADMIN, Role.SUPER_ADMIN],
  /** Field workers. */
  field: [Role.DRIVER, Role.CLEANER],
  customer: [Role.CUSTOMER],
} as const;

/**
 * Restricts a route to the given roles. Must run after `authenticate`.
 *
 *   router.get('/', authenticate, authorize(ROLE_GROUPS.dispatch), handler)
 */
export const authorize =
  (...allowed: readonly Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required', 'TOKEN_MISSING'));
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(new ForbiddenError('You do not have permission to perform this action', 'INSUFFICIENT_ROLE'));
      return;
    }
    next();
  };

/** True for back-office roles, which may read any customer's records. */
export const isStaff = (role: Role): boolean =>
  (ROLE_GROUPS.staff as readonly Role[]).includes(role);

export const isAdmin = (role: Role): boolean =>
  (ROLE_GROUPS.admin as readonly Role[]).includes(role);
