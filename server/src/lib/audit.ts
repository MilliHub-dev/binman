import type { Request } from 'express';
import { prisma } from './prisma';
import { createLogger } from './logger';

const log = createLogger('audit');

export interface AuditInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Records an administrative action (trsa.md §19).
 *
 * Auditing must never break the operation it is recording, so failures are
 * logged and swallowed. Callers do not await this on the request path.
 */
export const recordAudit = async (input: AuditInput): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        oldData: (input.oldData ?? undefined) as never,
        newData: (input.newData ?? undefined) as never,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    log.error({ err, action: input.action, entity: input.entity }, 'failed to write audit log');
  }
};

/** Pulls actor + client details straight off the request. */
export const auditFromRequest = (
  req: Request,
  input: Omit<AuditInput, 'userId' | 'ipAddress' | 'userAgent'>,
): Promise<void> =>
  recordAudit({
    ...input,
    userId: req.user?.id ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });
