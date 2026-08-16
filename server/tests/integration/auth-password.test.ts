import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { api, startServer, stopServer } from './client';

/**
 * Staff email + password sign-in.
 *
 * Covers the security properties that matter more than the happy path: that
 * failures are indistinguishable, that non-staff cannot get in, and that a
 * seeded password cannot be kept.
 */

const prisma = new PrismaClient();

const SEEDED_EMAIL = 'admin@binman.com';
const SEEDED_PASSWORD = 'Admin@123dev';
const NEW_PASSWORD = 'Uyo$Collect2026';

let accessToken = '';

beforeAll(async () => {
  await startServer();
});

afterAll(async () => {
  await stopServer();
  await prisma.$disconnect();
});

describe('Staff password sign-in', () => {
  it('signs in with the seeded credentials', async () => {
    const result = await api.post('/api/v1/auth/login', {
      email: SEEDED_EMAIL,
      password: SEEDED_PASSWORD,
    });

    expect(result.status).toBe(200);
    expect(result.body.data.accessToken).toBeTruthy();
    expect(result.body.data.user.role).toBe('SUPER_ADMIN');
    expect(result.body.data.user.email).toBe(SEEDED_EMAIL);
    // A seeded password is a known one, so the console must force a change.
    expect(result.body.data.mustChangePassword).toBe(true);

    accessToken = result.body.data.accessToken;
  });

  it('accepts the email in any casing', async () => {
    const result = await api.post('/api/v1/auth/login', {
      email: 'ADMIN@BinMan.COM',
      password: SEEDED_PASSWORD,
    });
    expect(result.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const result = await api.post('/api/v1/auth/login', {
      email: SEEDED_EMAIL,
      password: 'wrong-password',
    });
    expect(result.status).toBe(401);
    expect(result.body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives an unknown email the SAME error as a wrong password', async () => {
    const unknown = await api.post('/api/v1/auth/login', {
      email: 'nobody@binman.com',
      password: 'whatever',
    });
    const wrongPassword = await api.post('/api/v1/auth/login', {
      email: SEEDED_EMAIL,
      password: 'wrong-password',
    });

    // Identical responses: an attacker cannot enumerate which staff addresses
    // exist by comparing them.
    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body.message).toBe(wrongPassword.body.message);
    expect(unknown.body.error?.code).toBe(wrongPassword.body.error?.code);
  });

  it('refuses a customer account even with the right password', async () => {
    // Customers never get a password, so this is the passwordless branch.
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    if (customer?.email) {
      const result = await api.post('/api/v1/auth/login', {
        email: customer.email,
        password: SEEDED_PASSWORD,
      });
      expect(result.status).toBe(401);
      expect(result.body.error?.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('rejects a malformed email before touching the database', async () => {
    const result = await api.post('/api/v1/auth/login', {
      email: 'not-an-email',
      password: SEEDED_PASSWORD,
    });
    expect(result.status).toBe(422);
    expect(result.body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('the issued token works against an admin endpoint', async () => {
    const result = await api.get('/api/v1/admin/dashboard', accessToken);
    expect(result.status).toBe(200);
    expect(result.body.data.bookings).toBeDefined();
  });
});

describe('Changing a password', () => {
  it('refuses a weak new password', async () => {
    const result = await api.post(
      '/api/v1/auth/change-password',
      { currentPassword: SEEDED_PASSWORD, newPassword: 'short' },
      accessToken,
    );
    expect(result.status).toBe(422);
  });

  it('refuses when the current password is wrong', async () => {
    const result = await api.post(
      '/api/v1/auth/change-password',
      { currentPassword: 'not-my-password', newPassword: NEW_PASSWORD },
      accessToken,
    );
    expect(result.status).toBe(401);
    expect(result.body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('changes the password and clears the must-change flag', async () => {
    const result = await api.post(
      '/api/v1/auth/change-password',
      { currentPassword: SEEDED_PASSWORD, newPassword: NEW_PASSWORD },
      accessToken,
    );
    expect(result.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: SEEDED_EMAIL } });
    expect(user?.mustChangePassword).toBe(false);
  });

  it('the old password no longer works', async () => {
    const result = await api.post('/api/v1/auth/login', {
      email: SEEDED_EMAIL,
      password: SEEDED_PASSWORD,
    });
    expect(result.status).toBe(401);
  });

  it('the new password does', async () => {
    const result = await api.post('/api/v1/auth/login', {
      email: SEEDED_EMAIL,
      password: NEW_PASSWORD,
    });
    expect(result.status).toBe(200);
    expect(result.body.data.mustChangePassword).toBe(false);
  });
});
