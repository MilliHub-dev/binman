import type { Role } from '@prisma/client';

/**
 * Request augmentations set by our own middleware. Declared globally so every
 * controller sees them without importing a custom Request type.
 */
declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      phone: string;
      role: Role;
      /** Present only for users with a driver profile. */
      driverId?: string;
    }

    interface Request {
      /** Set by `authenticate`. Guaranteed present after that middleware. */
      user?: AuthenticatedUser;
      /** Correlation id echoed in responses and attached to every log line. */
      requestId?: string;
      /** Raw body buffer, captured only on webhook routes for signature checks. */
      rawBody?: Buffer;
    }
  }
}

export {};
