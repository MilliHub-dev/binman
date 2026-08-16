import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { addressesRouter } from './modules/addresses/addresses.routes';
import { timeSlotsRouter } from './modules/time-slots/time-slots.routes';
import { pricingRouter } from './modules/pricing/pricing.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { driverRouter } from './modules/driver/driver.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { deliveryWebhookRouter } from './modules/notifications/delivery-webhook.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { supportRouter } from './modules/support/support.routes';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes';
import { geoRouter } from './modules/geo/geo.routes';
import { listServiceAreas } from './modules/service-areas/service-areas.service';
import { ok } from './lib/http';

/** Everything under /api/v1 (trsa.md §5). */
export const apiRouter: Router = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/addresses', addressesRouter);
apiRouter.use('/geo', geoRouter);
apiRouter.use('/time-slots', timeSlotsRouter);
apiRouter.use('/pricing', pricingRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/subscriptions', subscriptionsRouter);
apiRouter.use('/notifications', notificationsRouter);
/** Provider callbacks. Unauthenticated by necessity — verified by shared secret. */
apiRouter.use('/webhooks', deliveryWebhookRouter);
apiRouter.use('/reviews', reviewsRouter);
apiRouter.use('/support', supportRouter);
apiRouter.use('/driver', driverRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/whatsapp', whatsappRouter);

/** Public: the app shows coverage during onboarding, before sign-in. */
apiRouter.get('/service-areas', async (_req, res) => ok(res, await listServiceAreas(true)));
