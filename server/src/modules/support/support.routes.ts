import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { authenticate, requireUser } from '../../middleware/authenticate';
import { authorize, ROLE_GROUPS } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { created, ok, paginated, param } from '../../lib/http';
import { buildMeta, paginationQuery, toSkipTake } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import { generateTicketNumber } from '../../lib/reference';

/**
 * Customer support tickets (prd.md §24). In-app chat is a future feature; this
 * covers the "raise an issue and have someone answer it" path that support
 * agents work from.
 */

const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Give your issue a short title').max(150),
  description: z.string().trim().min(5, 'Describe the issue').max(3000),
  bookingId: z.string().min(1).optional(),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.NORMAL),
});

const ticketsQuery = z.object({
  ...paginationQuery,
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
});

const updateTicketSchema = z
  .object({
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    assignedTo: z.string().min(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field' });

export const supportRouter: Router = Router();

supportRouter.use(authenticate);

/** POST /api/v1/support/tickets */
supportRouter.post(
  '/tickets',
  validate({ body: createTicketSchema }),
  async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = req.body as z.infer<typeof createTicketSchema>;

    // A ticket may reference a booking, but only the customer's own.
    if (body.bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { id: body.bookingId, userId: user.id },
        select: { id: true },
      });
      if (!booking) throw new NotFoundError('Booking');
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        userId: user.id,
        bookingId: body.bookingId ?? null,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
      },
    });

    return created(res, ticket, 'Support ticket created. We will be in touch shortly.');
  },
);

/** GET /api/v1/support/tickets — the customer's own tickets. */
supportRouter.get('/tickets', async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(
    res,
    await prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { booking: { select: { id: true, reference: true } } },
    }),
  );
});

/** GET /api/v1/support/admin/tickets — the support queue. */
supportRouter.get(
  '/admin/tickets',
  authorize(...ROLE_GROUPS.staff),
  validate({ query: ticketsQuery }),
  async (req: Request, res: Response) => {
    const query = req.query as unknown as z.infer<typeof ticketsQuery>;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          booking: { select: { id: true, reference: true } },
        },
        // Urgent first, then oldest — nothing sits forgotten at the bottom.
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        ...toSkipTake(query),
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return paginated(res, items, buildMeta(total, query));
  },
);

/** PATCH /api/v1/support/admin/tickets/:id */
supportRouter.patch(
  '/admin/tickets/:id',
  authorize(...ROLE_GROUPS.staff),
  validate({ body: updateTicketSchema }),
  async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const body = req.body as z.infer<typeof updateTicketSchema>;

    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Ticket');

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.priority ? { priority: body.priority } : {}),
        ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo } : {}),
        ...(body.status === TicketStatus.RESOLVED ? { resolvedAt: new Date() } : {}),
      },
    });

    return ok(res, ticket, 'Ticket updated');
  },
);
