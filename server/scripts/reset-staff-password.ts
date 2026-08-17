/**
 * Resets a staff password from the command line.
 *
 *   npm run staff:reset -- admin@binman.com
 *   npm run staff:reset -- admin@binman.com 'SomePassword123'
 *
 * Exists because the seeded credentials are single-use by design: the first
 * sign-in forces a change, so `Admin@123dev` stops working the moment anyone
 * uses it. Without this, the only way back into a locked-out account was
 * hand-written Prisma in a shell.
 *
 * The new password must be changed again at next sign-in, and every existing
 * session for the account is revoked — a reset is exactly when you want any
 * stolen session to die.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword, assertPasswordStrength, PASSWORD_ROLES } from '../src/modules/auth/password.service';

const prisma = new PrismaClient();

/** Readable, and comfortably past the strength rules. */
const generate = (): string => {
  const body = randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '');
  return `Bin${body}7x`;
};

const main = async () => {
  const [email, supplied] = process.argv.slice(2);

  if (!email) {
    console.error('Usage: npm run staff:reset -- <email> [password]');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  if (!user) {
    console.error(`No account with the email ${email}.`);
    process.exit(1);
  }

  if (!PASSWORD_ROLES.includes(user.role)) {
    console.error(
      `${email} is a ${user.role}, which signs in with a phone code rather than a password.`,
    );
    process.exit(1);
  }

  const password = supplied ?? generate();
  assertPasswordStrength(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  console.log(`\nPassword reset for ${email} (${user.role})\n`);
  console.log(`  password: ${password}`);
  console.log('\nIt must be changed at next sign-in, and other sessions were signed out.');
  console.log('This is the only time it is shown.\n');
};

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
