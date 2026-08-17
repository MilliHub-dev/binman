import type { Request, Response } from 'express';
import { created, ok, paginated, param } from '../../lib/http';
import { requireUser } from '../../middleware/authenticate';
import { fromRequest as pagination } from '../../lib/pagination';
import { auditFromRequest } from '../../lib/audit';
import * as dashboard from './dashboard.service';
import * as dispatch from './dispatch.service';
import * as fleet from './fleet.service';
import * as customers from './customers.service';
import * as adminBookings from './admin-bookings.service';
import * as reports from './reports.service';
import * as pricing from '../pricing/pricing.service';
import * as serviceAreas from '../service-areas/service-areas.service';
import * as timeSlots from '../time-slots/time-slots.service';
import { prisma } from '../../lib/prisma';

// --- Dashboard --------------------------------------------------------------

export const getDashboard = async (_req: Request, res: Response) =>
  ok(res, await dashboard.getDashboard());

export const getLiveOperations = async (_req: Request, res: Response) =>
  ok(res, await dashboard.getLiveOperations());

export const getMap = async (_req: Request, res: Response) => ok(res, await dashboard.getMapData());

// --- Bookings ---------------------------------------------------------------

export const listBookings = async (req: Request, res: Response) => {
  const query = req.query as unknown as Parameters<typeof adminBookings.listBookings>[1];
  const { items, meta } = await adminBookings.listBookings(pagination(req), query);
  return paginated(res, items, meta);
};

export const getBooking = async (req: Request, res: Response) =>
  ok(res, await adminBookings.getBooking(param(req, 'id')));

export const changeBookingStatus = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { status, reason } = req.body as { status: never; reason?: string };
  const booking = await adminBookings.changeStatus(param(req, 'id'), status, user.id, reason);
  return ok(res, booking, 'Booking status updated');
};

export const cancelBooking = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { reason } = req.body as { reason: string };
  const booking = await adminBookings.cancelBooking(param(req, 'id'), user.id, reason);
  return ok(res, booking, 'Booking cancelled');
};

// --- Dispatch ---------------------------------------------------------------

export const getDispatchBoard = async (req: Request, res: Response) => {
  const { date } = req.query as { date?: string };
  return ok(res, await dispatch.getDispatchBoard(date));
};

export const assignBooking = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const booking = await dispatch.assignBooking(param(req, 'id'), req.body as never, user.id);
  return ok(res, booking, 'Booking assigned');
};

export const unassignBooking = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { reason } = req.body as { reason?: string };
  const booking = await dispatch.unassignBooking(param(req, 'id'), user.id, reason);
  return ok(res, booking, 'Booking returned to the dispatch queue');
};

// --- Customers --------------------------------------------------------------

export const listCustomers = async (req: Request, res: Response) => {
  const query = req.query as unknown as { search?: string; status?: never };
  const { items, meta } = await customers.listCustomers(pagination(req), query);
  return paginated(res, items, meta);
};

export const getCustomer = async (req: Request, res: Response) =>
  ok(res, await customers.getCustomer(param(req, 'id')));

export const setCustomerStatus = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { status } = req.body as { status: never };
  const updated = await customers.setCustomerStatus(param(req, 'id'), status, user.id);
  return ok(res, updated, 'Customer status updated');
};

// --- Drivers ----------------------------------------------------------------

export const listDrivers = async (req: Request, res: Response) => {
  const query = req.query as unknown as { status?: never; search?: string };
  const { items, meta } = await fleet.listDrivers(pagination(req), query);
  return paginated(res, items, meta);
};

export const getDriver = async (req: Request, res: Response) =>
  ok(res, await fleet.getDriver(param(req, 'id')));

export const createDriver = async (req: Request, res: Response) => {
  const driver = await fleet.createDriver(req.body as never);
  void auditFromRequest(req, { action: 'DRIVER_CREATED', entity: 'Driver', entityId: driver.id });
  return created(res, driver, 'Driver created');
};

export const updateDriver = async (req: Request, res: Response) => {
  const driver = await fleet.updateDriver(param(req, 'id'), req.body as never);
  void auditFromRequest(req, {
    action: 'DRIVER_UPDATED',
    entity: 'Driver',
    entityId: driver.id,
    newData: req.body,
  });
  return ok(res, driver, 'Driver updated');
};

export const suspendDriver = async (req: Request, res: Response) => {
  const driver = await fleet.suspendDriver(param(req, 'id'));
  void auditFromRequest(req, { action: 'DRIVER_SUSPENDED', entity: 'Driver', entityId: driver.id });
  return ok(res, driver, 'Driver suspended');
};

// --- Trucks -----------------------------------------------------------------

export const listTrucks = async (req: Request, res: Response) => {
  const query = req.query as unknown as { status?: never; search?: string };
  const { items, meta } = await fleet.listTrucks(pagination(req), query);
  return paginated(res, items, meta);
};

export const createTruck = async (req: Request, res: Response) => {
  const truck = await fleet.createTruck(req.body as never);
  void auditFromRequest(req, { action: 'TRUCK_CREATED', entity: 'Truck', entityId: truck.id });
  return created(res, truck, 'Truck created');
};

export const updateTruck = async (req: Request, res: Response) => {
  const truck = await fleet.updateTruck(param(req, 'id'), req.body as never);
  void auditFromRequest(req, {
    action: 'TRUCK_UPDATED',
    entity: 'Truck',
    entityId: truck.id,
    newData: req.body,
  });
  return ok(res, truck, 'Truck updated');
};

// --- Pricing ----------------------------------------------------------------

export const listPricingRules = async (_req: Request, res: Response) =>
  ok(res, await prisma.pricingRule.findMany({ orderBy: [{ serviceType: 'asc' }, { basePrice: 'asc' }] }));

export const createPricingRule = async (req: Request, res: Response) => {
  const rule = await prisma.pricingRule.create({ data: req.body as never });
  void auditFromRequest(req, {
    action: 'PRICING_RULE_CREATED',
    entity: 'PricingRule',
    entityId: rule.id,
    newData: rule,
  });
  return created(res, rule, 'Pricing rule created');
};

export const updatePricingRule = async (req: Request, res: Response) => {
  const id = param(req, 'id');
  const before = await prisma.pricingRule.findUnique({ where: { id } });
  const rule = await prisma.pricingRule.update({ where: { id }, data: req.body as never });
  void auditFromRequest(req, {
    action: 'PRICING_RULE_UPDATED',
    entity: 'PricingRule',
    entityId: id,
    oldData: before,
    newData: rule,
  });
  return ok(res, rule, 'Pricing rule updated');
};

export const previewPrice = async (req: Request, res: Response) =>
  ok(res, await pricing.quote(req.body as never));

// --- Service areas ----------------------------------------------------------

export const listServiceAreas = async (_req: Request, res: Response) =>
  ok(res, await serviceAreas.listServiceAreas(false));

export const createServiceArea = async (req: Request, res: Response) => {
  const area = await serviceAreas.createServiceArea(req.body as never);
  void auditFromRequest(req, { action: 'SERVICE_AREA_CREATED', entity: 'ServiceArea', entityId: area.id });
  return created(res, area, 'Service area created');
};

export const updateServiceArea = async (req: Request, res: Response) => {
  const area = await serviceAreas.updateServiceArea(param(req, 'id'), req.body as never);
  void auditFromRequest(req, {
    action: 'SERVICE_AREA_UPDATED',
    entity: 'ServiceArea',
    entityId: area.id,
    newData: req.body,
  });
  return ok(res, area, 'Service area updated');
};

// --- Time slots -------------------------------------------------------------

export const listTimeSlots = async (_req: Request, res: Response) =>
  ok(res, await prisma.timeSlot.findMany({ orderBy: { sortOrder: 'asc' } }));

export const createTimeSlot = async (req: Request, res: Response) => {
  const slot = await timeSlots.createTimeSlot(req.body as never);
  void auditFromRequest(req, { action: 'TIME_SLOT_CREATED', entity: 'TimeSlot', entityId: slot.id });
  return created(res, slot, 'Time slot created');
};

export const updateTimeSlot = async (req: Request, res: Response) => {
  const slot = await timeSlots.updateTimeSlot(param(req, 'id'), req.body as never);
  void auditFromRequest(req, {
    action: 'TIME_SLOT_UPDATED',
    entity: 'TimeSlot',
    entityId: slot.id,
    newData: req.body,
  });
  return ok(res, slot, 'Time slot updated');
};

// --- Reports ----------------------------------------------------------------

export const revenueReport = async (req: Request, res: Response) =>
  ok(res, await reports.revenueReport(req.query as unknown as { from: string; to: string }));

export const bookingsReport = async (req: Request, res: Response) =>
  ok(res, await reports.bookingsReport(req.query as unknown as { from: string; to: string }));

export const driverReport = async (req: Request, res: Response) =>
  ok(res, await reports.driverPerformanceReport(req.query as unknown as { from: string; to: string }));

export const subscriptionReport = async (_req: Request, res: Response) =>
  ok(res, await reports.subscriptionReport());

export const exportBookings = async (req: Request, res: Response) => {
  const { from, to, format } = req.query as unknown as { from: string; to: string; format: 'json' | 'csv' };
  const result = await reports.exportBookings({ from, to });

  void auditFromRequest(req, {
    action: 'BOOKINGS_EXPORTED',
    entity: 'Booking',
    newData: { from, to, rows: result.rows.length },
  });

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bookings-${from}-to-${to}.csv"`);
    return res.status(200).send(reports.toCsv(result.rows));
  }

  // The caller must be able to tell a full page from a truncated one.
  return ok(res, result, result.truncated ? `Truncated to the first ${result.limit} rows` : 'Success');
};

// --- Audit ------------------------------------------------------------------

export const listAuditLogs = async (req: Request, res: Response) => {
  const { page, limit } = pagination(req);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, role: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  return paginated(res, items, {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: page * limit < total,
  });
};
