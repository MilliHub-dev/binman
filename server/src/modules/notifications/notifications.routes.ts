import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { NotificationChannel } from '@prisma/client';
import { authenticate, requireUser } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { ok, paginated, param } from '../../lib/http';
import { buildMeta, paginationQuery, toSkipTake } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';

/** The notifications screen (ui.md §37). */

const listQuery = z.object({
  ...paginationQuery,
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const notificationsRouter: Router = Router();

notificationsRouter.use(authenticate);

/** GET /api/v1/notifications */
notificationsRouter.get('/', validate({ query: listQuery }), async (req: Request, res: Response) => {
  const user = requireUser(req);
  const query = req.query as unknown as z.infer<typeof listQuery>;

  // Only IN_APP rows belong on the notifications screen — SMS and WhatsApp
  // copies are delivery records, not feed items.
  const where = {
    userId: user.id,
    channel: NotificationChannel.IN_APP,
    ...(query.unreadOnly ? { readAt: null } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.notification.count({ where }),
  ]);

  return paginated(res, items, buildMeta(total, query));
});

/** GET /api/v1/notifications/unread-count — drives the header badge. */
notificationsRouter.get('/unread-count', async (req: Request, res: Response) => {
  const user = requireUser(req);
  const count = await prisma.notification.count({
    where: { userId: user.id, channel: NotificationChannel.IN_APP, readAt: null },
  });
  return ok(res, { count });
});

/** POST /api/v1/notifications/:id/read */
notificationsRouter.post('/:id/read', async (req: Request, res: Response) => {
  const user = requireUser(req);
  // updateMany scopes by userId, so one customer cannot mark another's read.
  await prisma.notification.updateMany({
    where: { id: param(req, 'id'), userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return ok(res, null, 'Notification marked as read');
});

/** POST /api/v1/notifications/read-all */
notificationsRouter.post('/read-all', async (req: Request, res: Response) => {
  const user = requireUser(req);
  const result = await prisma.notification.updateMany({
    where: { userId: user.id, channel: NotificationChannel.IN_APP, readAt: null },
    data: { readAt: new Date() },
  });
  return ok(res, { updated: result.count }, 'All notifications marked as read');
});
