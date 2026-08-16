import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, Role } from '@prisma/client';
import { api, signIn, startServer, stopServer, waitFor } from './client';
import { __resetFlutterwave, state as fwState } from './fakes/flutterwave';
import { jobsFor, __resetQueues } from './fakes/queues';

/**
 * The end-to-end journey from trsa.md §16:
 *
 *   register -> add address -> book -> pay -> admin assigns -> driver completes
 *   -> customer is notified -> customer reviews
 *
 * Each step asserts the state the NEXT step depends on, so a break is localised
 * rather than surfacing three steps later.
 */

const prisma = new PrismaClient();

// Distinct numbers per suite so runs cannot collide on the unique phone index.
const CUSTOMER_PHONE = '08111000001';
const ADMIN_PHONE = '+2348000000001';
const DRIVER_PHONE = '+2348000000003';

let customer = { token: '', userId: '' };
let admin = { token: '', userId: '' };
let driver = { token: '', userId: '' };

let addressId = '';
let timeSlotId = '';
let bookingId = '';
let bookingRef = '';
let paymentReference = '';
let assignmentId = '';
let scheduledDate = '';

/** Tomorrow, so the slot is never already in the past. */
const tomorrow = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  await startServer();
  __resetFlutterwave();
  __resetQueues();
  scheduledDate = tomorrow();
});

afterAll(async () => {
  await stopServer();
  await prisma.$disconnect();
});

describe('1. Authentication', () => {
  it('registers a brand-new customer from a phone number alone', async () => {
    const requested = await api.post('/api/v1/auth/request-otp', { phone: CUSTOMER_PHONE });
    expect(requested.status).toBe(200);
    expect(requested.body.data.isNewUser).toBe(true);
    expect(requested.body.data.debugCode).toMatch(/^\d{6}$/);

    const verified = await api.post('/api/v1/auth/verify-otp', {
      phone: CUSTOMER_PHONE,
      otp: requested.body.data.debugCode,
    });

    expect(verified.status).toBe(200);
    expect(verified.body.data.accessToken).toBeTruthy();
    expect(verified.body.data.refreshToken).toBeTruthy();
    // Registration is implicit; the profile screen comes next.
    expect(verified.body.data.profileComplete).toBe(false);
    // The number must be stored in E.164 regardless of how it was typed.
    expect(verified.body.data.user.phone).toBe('+2348111000001');

    customer = { token: verified.body.data.accessToken, userId: verified.body.data.user.id };
  });

  it('rejects an incorrect OTP', async () => {
    await api.post('/api/v1/auth/request-otp', { phone: '08111000099' });
    const result = await api.post('/api/v1/auth/verify-otp', {
      phone: '08111000099',
      otp: '000000',
    });
    expect(result.status).toBe(401);
    expect(result.body.error?.code).toBe('OTP_INVALID');
  });

  it('rejects a malformed phone number', async () => {
    const result = await api.post('/api/v1/auth/request-otp', { phone: 'not-a-phone' });
    expect(result.status).toBe(422);
    expect(result.body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('completes the profile', async () => {
    const result = await api.post(
      '/api/v1/auth/complete-profile',
      { firstName: 'Ekemini', lastName: 'Effiong', email: 'ekemini@example.ng' },
      customer.token,
    );
    expect(result.status).toBe(201);
    expect(result.body.data.fullName).toBe('Ekemini Effiong');
    expect(result.body.data.profileComplete).toBe(true);
  });

  it('returns the signed-in user', async () => {
    const result = await api.get('/api/v1/users/me', customer.token);
    expect(result.status).toBe(200);
    expect(result.body.data.phone).toBe('+2348111000001');
  });

  it('refuses an unauthenticated request', async () => {
    const result = await api.get('/api/v1/users/me');
    expect(result.status).toBe(401);
    expect(result.body.error?.code).toBe('TOKEN_MISSING');
  });

  it('rotates a refresh token and invalidates the old one', async () => {
    const login = await api.post('/api/v1/auth/request-otp', { phone: '08111000002' });
    const verified = await api.post('/api/v1/auth/verify-otp', {
      phone: '08111000002',
      otp: login.body.data.debugCode,
    });
    const original = verified.body.data.refreshToken;

    const first = await api.post('/api/v1/auth/refresh', { refreshToken: original });
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toBeTruthy();

    // Replaying a spent token is treated as theft.
    const replay = await api.post('/api/v1/auth/refresh', { refreshToken: original });
    expect(replay.status).toBe(401);
    expect(replay.body.error?.code).toBe('REFRESH_TOKEN_REUSED');
  });

  it('signs in the seeded admin and driver', async () => {
    admin = await signIn(ADMIN_PHONE);
    driver = await signIn(DRIVER_PHONE);

    const adminUser = await prisma.user.findUnique({ where: { phone: ADMIN_PHONE } });
    expect(adminUser?.role).toBe(Role.SUPER_ADMIN);
  });
});

describe('2. Addresses and coverage', () => {
  it('saves an address inside the service area', async () => {
    const result = await api.post(
      '/api/v1/addresses',
      {
        label: 'Home',
        addressLine: '15 Udo Udoma Avenue',
        area: 'Ewet Housing Estate',
        city: 'Uyo',
        state: 'Akwa Ibom',
        latitude: 5.0377,
        longitude: 7.9128,
        instructions: 'Blue gate',
      },
      customer.token,
    );

    expect(result.status).toBe(201);
    expect(result.body.data.serviceable).toBe(true);
    // The first address becomes the default automatically.
    expect(result.body.data.isDefault).toBe(true);
    addressId = result.body.data.id;
  });

  it('lists the customer’s addresses', async () => {
    const result = await api.get('/api/v1/addresses', customer.token);
    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(1);
  });

  it('flags an address outside any operating area as unserviceable', async () => {
    const result = await api.post(
      '/api/v1/addresses',
      { label: 'Village', addressLine: '1 Far Road', area: 'Nowhere', city: 'Kano', state: 'Kano' },
      customer.token,
    );
    expect(result.status).toBe(201);
    expect(result.body.data.serviceable).toBe(false);
  });

  it('will not let one customer read another’s address', async () => {
    const stranger = await signIn('08111000003');
    const result = await api.patch(
      `/api/v1/addresses/${addressId}`,
      { label: 'Hijacked' },
      stranger.token,
    );
    expect(result.status).toBe(404);
  });
});

describe('3. Scheduling and pricing', () => {
  it('lists active time slots', async () => {
    const result = await api.get('/api/v1/time-slots');
    expect(result.status).toBe(200);
    expect(result.body.data.length).toBe(4);
    timeSlotId = result.body.data[0].id;
  });

  it('reports per-date availability', async () => {
    const result = await api.get(`/api/v1/time-slots/availability?date=${scheduledDate}`);
    expect(result.status).toBe(200);

    const slot = result.body.data.find((s: any) => s.id === timeSlotId);
    expect(slot.available).toBe(true);
    expect(slot.remaining).toBe(slot.maxBookings - slot.booked);
  });

  it('refuses a date in the past', async () => {
    const result = await api.get('/api/v1/time-slots/availability?date=2020-01-01');
    expect(result.status).toBe(400);
    expect(result.body.error?.code).toBe('DATE_IN_PAST');
  });

  it('quotes a price server-side from the saved address', async () => {
    const result = await api.post(
      '/api/v1/pricing/quote',
      {
        serviceType: 'WASTE_COLLECTION',
        wasteTypes: ['HOUSEHOLD'],
        collectionSize: 'MEDIUM',
        addressId,
      },
      customer.token,
    );

    expect(result.status).toBe(200);
    // Seeded: medium household ₦2,500 base + ₦500 fee, no Ewet surcharge.
    expect(result.body.data.subtotal).toBe(250_000);
    expect(result.body.data.serviceFee).toBe(50_000);
    expect(result.body.data.total).toBe(300_000);
    expect(result.body.data.formatted.total).toContain('3,000');
  });

  it('prices commercial waste above household at the same size', async () => {
    const household = await api.post(
      '/api/v1/pricing/quote',
      { serviceType: 'WASTE_COLLECTION', wasteTypes: ['HOUSEHOLD'], collectionSize: 'LARGE', addressId },
      customer.token,
    );
    const commercial = await api.post(
      '/api/v1/pricing/quote',
      { serviceType: 'WASTE_COLLECTION', wasteTypes: ['COMMERCIAL'], collectionSize: 'LARGE', addressId },
      customer.token,
    );
    // Proves the more specific rule wins over the size-only wildcard.
    expect(commercial.body.data.subtotal).toBeGreaterThan(household.body.data.subtotal);
  });

  it('rejects a quote with no size', async () => {
    const result = await api.post(
      '/api/v1/pricing/quote',
      { serviceType: 'WASTE_COLLECTION', wasteTypes: ['HOUSEHOLD'] },
      customer.token,
    );
    expect(result.status).toBe(422);
  });
});

describe('4. Booking', () => {
  it('creates a booking priced by the server', async () => {
    const result = await api.post(
      '/api/v1/bookings',
      {
        serviceType: 'WASTE_COLLECTION',
        addressId,
        scheduledDate,
        timeSlotId,
        wasteTypes: ['HOUSEHOLD'],
        collectionSize: 'MEDIUM',
        notes: 'Please call when you arrive.',
      },
      customer.token,
    );

    expect(result.status).toBe(201);
    expect(result.body.data.status).toBe('PENDING_PAYMENT');
    expect(result.body.data.paymentStatus).toBe('PENDING');
    expect(result.body.data.pricing.total).toBe(300_000);
    expect(result.body.data.reference).toMatch(/^WST[2-9A-Z]{6}$/);

    bookingId = result.body.data.id;
    bookingRef = result.body.data.reference;
  });

  it('ignores any price the client tries to supply', async () => {
    const result = await api.post(
      '/api/v1/bookings',
      {
        serviceType: 'WASTE_COLLECTION',
        addressId,
        scheduledDate,
        timeSlotId,
        wasteTypes: ['HOUSEHOLD'],
        collectionSize: 'MEDIUM',
        totalAmount: 1,
        subtotal: 1,
      },
      customer.token,
    );

    expect(result.status).toBe(201);
    // The injected amounts are stripped by validation, not honoured.
    expect(result.body.data.pricing.total).toBe(300_000);

    await prisma.booking.delete({ where: { id: result.body.data.id } });
  });

  it('refuses a booking to an unserviceable address', async () => {
    const outside = await api.post(
      '/api/v1/addresses',
      { label: 'Far', addressLine: '2 Far Road', area: 'Nowhere', city: 'Kano', state: 'Kano' },
      customer.token,
    );

    const result = await api.post(
      '/api/v1/bookings',
      {
        serviceType: 'WASTE_COLLECTION',
        addressId: outside.body.data.id,
        scheduledDate,
        timeSlotId,
        wasteTypes: ['HOUSEHOLD'],
        collectionSize: 'SMALL',
      },
      customer.token,
    );

    expect(result.status).toBe(400);
    expect(result.body.error?.code).toBe('OUTSIDE_SERVICE_AREA');
  });

  it('refuses a date beyond the booking horizon', async () => {
    const farOff = new Date();
    farOff.setUTCDate(farOff.getUTCDate() + 90);

    const result = await api.post(
      '/api/v1/bookings',
      {
        serviceType: 'WASTE_COLLECTION',
        addressId,
        scheduledDate: farOff.toISOString().slice(0, 10),
        timeSlotId,
        wasteTypes: ['HOUSEHOLD'],
        collectionSize: 'SMALL',
      },
      customer.token,
    );

    expect(result.status).toBe(400);
    expect(result.body.error?.code).toBe('DATE_TOO_FAR');
  });

  it('lists the booking under the upcoming tab', async () => {
    const result = await api.get('/api/v1/bookings?scope=upcoming', customer.token);
    expect(result.status).toBe(200);
    expect(result.body.data.some((b: any) => b.id === bookingId)).toBe(true);
    expect(result.body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it('finds a booking by reference, for the WhatsApp track flow', async () => {
    const result = await api.get(`/api/v1/bookings/reference/${bookingRef}`, customer.token);
    expect(result.status).toBe(200);
    expect(result.body.data.id).toBe(bookingId);
  });

  it('hides one customer’s booking from another', async () => {
    const stranger = await signIn('08111000004');
    const result = await api.get(`/api/v1/bookings/${bookingId}`, stranger.token);
    // 404 rather than 403 — an outsider learns nothing about which ids exist.
    expect(result.status).toBe(404);
  });
});

describe('5. Payment', () => {
  it('initiates a payment and returns a checkout link', async () => {
    const result = await api.post('/api/v1/payments/initiate', { bookingId }, customer.token);

    expect(result.status).toBe(201);
    expect(result.body.data.checkoutUrl).toContain('https://checkout.test/pay/');
    expect(result.body.data.amount).toBe(300_000);

    paymentReference = result.body.data.reference;
  });

  it('reuses the existing checkout session instead of orphaning it', async () => {
    const again = await api.post('/api/v1/payments/initiate', { bookingId }, customer.token);
    expect(again.body.data.reference).toBe(paymentReference);
  });

  it('rejects a webhook with a bad signature', async () => {
    const result = await api.raw('POST', '/api/v1/payments/webhook', {
      body: { event: 'charge.completed', data: { id: `fw_${paymentReference}`, tx_ref: paymentReference } },
      headers: { 'verif-hash': 'wrong-hash' },
    });

    expect(result.status).toBe(401);
    expect(result.body.error?.code).toBe('INVALID_WEBHOOK_SIGNATURE');

    // Crucially, the booking must NOT have advanced.
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('PENDING_PAYMENT');
  });

  it('does not credit a booking when the amount is wrong', async () => {
    fwState.amountOverride = 1; // ₦1 against a ₦3,000 booking.

    // A distinct provider transaction, as an underpayment really would be.
    const result = await api.raw('POST', '/api/v1/payments/webhook', {
      body: {
        event: 'charge.completed',
        data: { id: `fw_${paymentReference}#underpaid`, tx_ref: paymentReference },
      },
      headers: { 'verif-hash': 'test-hash' },
    });

    expect(result.status).toBe(200);
    expect(result.body.data.reason).toBe('AMOUNT_MISMATCH');

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('PENDING_PAYMENT');
    expect(booking?.paymentStatus).toBe('PENDING');

    fwState.amountOverride = null;
  });

  it('confirms the booking on a valid webhook', async () => {
    const result = await api.raw('POST', '/api/v1/payments/webhook', {
      body: { event: 'charge.completed', data: { id: `fw_${paymentReference}`, tx_ref: paymentReference } },
      headers: { 'verif-hash': 'test-hash' },
    });

    expect(result.status).toBe(200);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    // Paid, then straight into the dispatch queue.
    expect(booking?.paymentStatus).toBe('SUCCESSFUL');
    expect(booking?.status).toBe('PENDING_ASSIGNMENT');

    // The customer is told, over the channels they have enabled. Notifications
    // are fire-and-forget, so wait for the effect rather than racing it.
    const confirmed = await waitFor(
      () =>
        prisma.notification.findFirst({
          where: { userId: customer.userId, type: 'BOOKING_CONFIRMED' },
        }),
      { label: 'BOOKING_CONFIRMED notification' },
    );
    expect(confirmed).not.toBeNull();
  });

  it('ignores a redelivered webhook rather than double-applying it', async () => {
    const result = await api.raw('POST', '/api/v1/payments/webhook', {
      body: { event: 'charge.completed', data: { id: `fw_${paymentReference}`, tx_ref: paymentReference } },
      headers: { 'verif-hash': 'test-hash' },
    });

    expect(result.body.data.reason).toBe('DUPLICATE');

    const payments = await prisma.payment.count({ where: { bookingId, status: 'SUCCESSFUL' } });
    expect(payments).toBe(1);
  });

  it('refuses to charge an already-paid booking', async () => {
    const result = await api.post('/api/v1/payments/initiate', { bookingId }, customer.token);
    expect(result.status).toBe(409);
    expect(result.body.error?.code).toBe('ALREADY_PAID');
  });
});

describe('6. Dispatch', () => {
  it('shows the paid booking on the dispatch board', async () => {
    const result = await api.get(`/api/v1/admin/dispatch?date=${scheduledDate}`, admin.token);

    expect(result.status).toBe(200);
    expect(result.body.data.unassigned.some((b: any) => b.id === bookingId)).toBe(true);
    expect(result.body.data.drivers.length).toBeGreaterThan(0);
    expect(result.body.data.trucks.length).toBeGreaterThan(0);
  });

  it('keeps the dispatch board away from customers', async () => {
    const result = await api.get('/api/v1/admin/dispatch', customer.token);
    expect(result.status).toBe(403);
    expect(result.body.error?.code).toBe('INSUFFICIENT_ROLE');
  });

  it('assigns a driver and truck', async () => {
    const driverRecord = await prisma.driver.findFirst({
      where: { user: { phone: DRIVER_PHONE } },
    });
    const truck = await prisma.truck.findFirst({ where: { truckNumber: 'TRK-001' } });

    const result = await api.post(
      `/api/v1/admin/bookings/${bookingId}/assign`,
      { driverId: driverRecord!.id, truckId: truck!.id },
      admin.token,
    );

    expect(result.status).toBe(200);
    expect(result.body.data.status).toBe('ASSIGNED');
    expect(result.body.data.assignment.driver).not.toBeNull();

    assignmentId = result.body.data.assignment.id;
  });

  it('records the assignment in the audit log', async () => {
    const entry = await prisma.auditLog.findFirst({
      where: { entity: 'Booking', entityId: bookingId, action: 'BOOKING_ASSIGNED' },
    });
    expect(entry).not.toBeNull();
    expect(entry?.userId).toBe(admin.userId);
  });
});

describe('7. Driver workflow', () => {
  it('shows the job on the driver’s list', async () => {
    const result = await api.get(`/api/v1/driver/jobs?scope=today&date=${scheduledDate}`, driver.token);
    expect(result.status).toBe(200);

    const job = result.body.data.find((j: any) => j.booking.id === bookingId);
    expect(job).toBeTruthy();
    // The driver needs the customer's number and gate instructions.
    expect(job.booking.customer.phone).toBe('+2348111000001');
    expect(job.booking.address.instructions).toBe('Blue gate');
  });

  it('refuses a status update before the job is accepted', async () => {
    const result = await api.post(
      `/api/v1/driver/jobs/${assignmentId}/status`,
      { status: 'DRIVER_EN_ROUTE' },
      driver.token,
    );
    expect(result.status).toBe(409);
    expect(result.body.error?.code).toBe('JOB_NOT_ACCEPTED');
  });

  it('accepts the job', async () => {
    const result = await api.post(`/api/v1/driver/jobs/${assignmentId}/accept`, undefined, driver.token);
    expect(result.status).toBe(200);
    expect(result.body.data.assignmentStatus).toBe('ACCEPTED');
  });

  it('walks en route -> arrived -> collected, notifying the customer', async () => {
    for (const status of ['DRIVER_EN_ROUTE', 'ARRIVED', 'COLLECTED']) {
      const result = await api.post(
        `/api/v1/driver/jobs/${assignmentId}/status`,
        { status, latitude: 5.03, longitude: 7.91 },
        driver.token,
      );
      expect(result.status, `transition to ${status}`).toBe(200);
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('COLLECTED');

    const enRoute = await waitFor(
      () =>
        prisma.notification.findFirst({
          where: { userId: customer.userId, type: 'DRIVER_EN_ROUTE' },
        }),
      { label: 'DRIVER_EN_ROUTE notification' },
    );
    expect(enRoute).not.toBeNull();
  });

  it('refuses to skip a step in the lifecycle', async () => {
    const result = await api.post(
      `/api/v1/driver/jobs/${assignmentId}/status`,
      { status: 'ARRIVED' },
      driver.token,
    );
    expect(result.status).toBe(409);
    expect(result.body.error?.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('refuses completion until proof of collection exists', async () => {
    const result = await api.post(
      `/api/v1/driver/jobs/${assignmentId}/status`,
      { status: 'COMPLETED' },
      driver.token,
    );
    expect(result.status).toBe(409);
    expect(result.body.error?.code).toBe('PROOF_REQUIRED');
  });

  it('accepts proof, then allows completion', async () => {
    // The proof endpoint is multipart; post the photo as a real file part.
    const form = new FormData();
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    form.append('photos', new Blob([png], { type: 'image/png' }), 'proof.png');
    form.append('latitude', '9.0765');
    form.append('longitude', '7.3986');
    form.append('notes', 'Collected 4 bags');

    const uploaded = await fetch(
      `${await startServer()}/api/v1/driver/jobs/${assignmentId}/proof`,
      { method: 'POST', headers: { authorization: `Bearer ${driver.token}` }, body: form },
    );

    expect(uploaded.status).toBe(201);

    const completed = await api.post(
      `/api/v1/driver/jobs/${assignmentId}/status`,
      { status: 'COMPLETED' },
      driver.token,
    );
    expect(completed.status).toBe(200);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking?.status).toBe('COMPLETED');
    expect(booking?.completedAt).not.toBeNull();

    // Driver and truck are released for the next job.
    const driverRecord = await prisma.driver.findFirst({ where: { user: { phone: DRIVER_PHONE } } });
    expect(driverRecord?.availabilityStatus).toBe('AVAILABLE');
  });

  it('tells the customer the pickup is done', async () => {
    const notification = await waitFor(
      () =>
        prisma.notification.findFirst({
          where: { userId: customer.userId, type: 'BOOKING_COMPLETED' },
        }),
      { label: 'BOOKING_COMPLETED notification' },
    );
    expect(notification).not.toBeNull();
  });
});

describe('8. After the job', () => {
  it('shows the full status timeline', async () => {
    const result = await api.get(`/api/v1/bookings/${bookingId}/timeline`, customer.token);
    expect(result.status).toBe(200);

    const statuses = result.body.data.map((entry: any) => entry.newStatus);
    expect(statuses).toEqual([
      'PENDING_PAYMENT',
      'PAID',
      'PENDING_ASSIGNMENT',
      'ASSIGNED',
      'DRIVER_EN_ROUTE',
      'ARRIVED',
      'COLLECTED',
      'COMPLETED',
    ]);
  });

  it('accepts a review of the completed booking', async () => {
    const result = await api.post(
      '/api/v1/reviews',
      { bookingId, rating: 5, comment: 'Fast and tidy.' },
      customer.token,
    );
    expect(result.status).toBe(201);
    expect(result.body.data.rating).toBe(5);
  });

  it('allows only one review per booking', async () => {
    const result = await api.post('/api/v1/reviews', { bookingId, rating: 3 }, customer.token);
    expect(result.status).toBe(409);
    expect(result.body.error?.code).toBe('ALREADY_REVIEWED');
  });

  it('refuses a review of a booking that never completed', async () => {
    const fresh = await api.post(
      '/api/v1/bookings',
      {
        serviceType: 'WASTE_COLLECTION',
        addressId,
        scheduledDate,
        timeSlotId,
        wasteTypes: ['PLASTIC'],
        collectionSize: 'SMALL',
      },
      customer.token,
    );

    const result = await api.post(
      '/api/v1/reviews',
      { bookingId: fresh.body.data.id, rating: 5 },
      customer.token,
    );
    expect(result.status).toBe(409);
    expect(result.body.error?.code).toBe('BOOKING_NOT_COMPLETED');

    await prisma.booking.delete({ where: { id: fresh.body.data.id } });
  });

  it('cannot cancel a completed booking', async () => {
    const result = await api.post(`/api/v1/bookings/${bookingId}/cancel`, {}, customer.token);
    expect(result.status).toBe(409);
    expect(result.body.error?.code).toBe('BOOKING_NOT_CANCELLABLE');
  });

  it('queued outbound notification jobs along the way', () => {
    expect(jobsFor('notification').length).toBeGreaterThan(0);
  });
});
