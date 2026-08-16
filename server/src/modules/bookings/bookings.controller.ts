import type { Request, Response } from 'express';
import { created, ok, paginated, param } from '../../lib/http';
import { requireUser } from '../../middleware/authenticate';
import * as service from './bookings.service';
import type { CreateBookingInput, ListBookingsQuery } from './bookings.schema';

export const create = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const booking = await service.createBooking(user.id, req.body as CreateBookingInput);
  return created(res, booking, 'Booking created successfully');
};

export const list = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { items, meta } = await service.listBookings(user.id, req.query as unknown as ListBookingsQuery);
  return paginated(res, items, meta);
};

export const detail = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.getBooking(param(req, 'id'), user));
};

export const byReference = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.getBookingByReference(param(req, 'reference'), user.id));
};

export const timeline = async (req: Request, res: Response) => {
  const user = requireUser(req);
  return ok(res, await service.getBookingTimeline(param(req, 'id'), user.id, user.role));
};

export const cancel = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { reason } = req.body as { reason?: string };
  const result = await service.cancelBooking(param(req, 'id'), user.id, reason);
  return ok(res, { booking: result.booking, refundEligible: result.refundEligible }, result.message);
};

export const reschedule = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const booking = await service.rescheduleBooking(
    param(req, 'id'),
    user.id,
    req.body as { scheduledDate: string; timeSlotId: string },
  );
  return ok(res, booking, 'Booking rescheduled');
};
