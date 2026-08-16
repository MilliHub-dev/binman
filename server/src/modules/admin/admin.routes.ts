import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize, ROLE_GROUPS } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { paginationSchema } from '../../lib/pagination';
import * as controller from './admin.controller';
import {
  adminBookingsQuery,
  adminCancelSchema,
  assignBookingSchema,
  changeStatusSchema,
  createDriverSchema,
  createServiceAreaSchema,
  createTruckSchema,
  customerStatusSchema,
  customersQuery,
  dispatchQuery,
  driversQuery,
  exportQuery,
  idParam,
  reportRangeQuery,
  trucksQuery,
  unassignSchema,
  updateDriverSchema,
  updateServiceAreaSchema,
  updateTruckSchema,
} from './admin.schema';
import { createPricingRuleSchema, quoteSchema, updatePricingRuleSchema } from '../pricing/pricing.schema';
import { createTimeSlotSchema, updateTimeSlotSchema } from '../time-slots/time-slots.schema';

export const adminRouter: Router = Router();

// Everything below requires a signed-in back-office account. Individual routes
// narrow further — dispatch work is open to dispatchers, configuration is not.
adminRouter.use(authenticate, authorize(...ROLE_GROUPS.staff));

// --- Dashboard --------------------------------------------------------------
adminRouter.get('/dashboard', controller.getDashboard);
adminRouter.get('/operations/live', controller.getLiveOperations);
adminRouter.get('/operations/map', controller.getMap);

// --- Bookings ---------------------------------------------------------------
adminRouter.get('/bookings', validate({ query: adminBookingsQuery }), controller.listBookings);
adminRouter.get('/bookings/:id', validate({ params: idParam }), controller.getBooking);

adminRouter.patch(
  '/bookings/:id/status',
  authorize(...ROLE_GROUPS.dispatch),
  validate({ params: idParam, body: changeStatusSchema }),
  controller.changeBookingStatus,
);

adminRouter.post(
  '/bookings/:id/cancel',
  authorize(...ROLE_GROUPS.dispatch),
  validate({ params: idParam, body: adminCancelSchema }),
  controller.cancelBooking,
);

// --- Dispatch ---------------------------------------------------------------
adminRouter.get(
  '/dispatch',
  authorize(...ROLE_GROUPS.dispatch),
  validate({ query: dispatchQuery }),
  controller.getDispatchBoard,
);

adminRouter.post(
  '/bookings/:id/assign',
  authorize(...ROLE_GROUPS.dispatch),
  validate({ params: idParam, body: assignBookingSchema }),
  controller.assignBooking,
);

adminRouter.post(
  '/bookings/:id/unassign',
  authorize(...ROLE_GROUPS.dispatch),
  validate({ params: idParam, body: unassignSchema }),
  controller.unassignBooking,
);

// --- Customers --------------------------------------------------------------
adminRouter.get('/customers', validate({ query: customersQuery }), controller.listCustomers);
adminRouter.get('/customers/:id', validate({ params: idParam }), controller.getCustomer);
adminRouter.patch(
  '/customers/:id/status',
  authorize(...ROLE_GROUPS.admin),
  validate({ params: idParam, body: customerStatusSchema }),
  controller.setCustomerStatus,
);

// --- Drivers ----------------------------------------------------------------
adminRouter.get('/drivers', validate({ query: driversQuery }), controller.listDrivers);
adminRouter.get('/drivers/:id', validate({ params: idParam }), controller.getDriver);
adminRouter.post(
  '/drivers',
  authorize(...ROLE_GROUPS.admin),
  validate({ body: createDriverSchema }),
  controller.createDriver,
);
adminRouter.patch(
  '/drivers/:id',
  authorize(...ROLE_GROUPS.admin),
  validate({ params: idParam, body: updateDriverSchema }),
  controller.updateDriver,
);
adminRouter.post(
  '/drivers/:id/suspend',
  authorize(...ROLE_GROUPS.admin),
  validate({ params: idParam }),
  controller.suspendDriver,
);

// --- Trucks -----------------------------------------------------------------
adminRouter.get('/trucks', validate({ query: trucksQuery }), controller.listTrucks);
adminRouter.post(
  '/trucks',
  authorize(...ROLE_GROUPS.admin),
  validate({ body: createTruckSchema }),
  controller.createTruck,
);
adminRouter.patch(
  '/trucks/:id',
  authorize(...ROLE_GROUPS.admin),
  validate({ params: idParam, body: updateTruckSchema }),
  controller.updateTruck,
);

// --- Pricing (admin.md §6) --------------------------------------------------
adminRouter.get('/pricing', controller.listPricingRules);
adminRouter.post(
  '/pricing',
  authorize(...ROLE_GROUPS.admin),
  validate({ body: createPricingRuleSchema }),
  controller.createPricingRule,
);
adminRouter.patch(
  '/pricing/:id',
  authorize(...ROLE_GROUPS.admin),
  validate({ params: idParam, body: updatePricingRuleSchema }),
  controller.updatePricingRule,
);
/** Dry-run a quote against the current rules before publishing a change. */
adminRouter.post(
  '/pricing/preview',
  authorize(...ROLE_GROUPS.admin),
  validate({ body: quoteSchema }),
  controller.previewPrice,
);

// --- Service areas (admin.md §7) --------------------------------------------
adminRouter.get('/service-areas', controller.listServiceAreas);
adminRouter.post(
  '/service-areas',
  authorize(...ROLE_GROUPS.admin),
  validate({ body: createServiceAreaSchema }),
  controller.createServiceArea,
);
adminRouter.patch(
  '/service-areas/:id',
  authorize(...ROLE_GROUPS.admin),
  validate({ params: idParam, body: updateServiceAreaSchema }),
  controller.updateServiceArea,
);

// --- Time slots -------------------------------------------------------------
adminRouter.get('/time-slots', controller.listTimeSlots);
adminRouter.post(
  '/time-slots',
  authorize(...ROLE_GROUPS.admin),
  validate({ body: createTimeSlotSchema }),
  controller.createTimeSlot,
);
adminRouter.patch(
  '/time-slots/:id',
  authorize(...ROLE_GROUPS.admin),
  validate({ params: idParam, body: updateTimeSlotSchema }),
  controller.updateTimeSlot,
);

// --- Reports (admin.md §8) --------------------------------------------------
adminRouter.get('/reports/revenue', validate({ query: reportRangeQuery }), controller.revenueReport);
adminRouter.get('/reports/bookings', validate({ query: reportRangeQuery }), controller.bookingsReport);
adminRouter.get('/reports/drivers', validate({ query: reportRangeQuery }), controller.driverReport);
adminRouter.get('/reports/subscriptions', controller.subscriptionReport);
adminRouter.get('/reports/export/bookings', validate({ query: exportQuery }), controller.exportBookings);

// --- Audit trail (trsa.md §19) ----------------------------------------------
adminRouter.get(
  '/audit-logs',
  authorize(...ROLE_GROUPS.admin),
  validate({ query: paginationSchema }),
  controller.listAuditLogs,
);
