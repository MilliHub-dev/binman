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
import { randomInt } from 'node:crypto';
// The app's client, not a bare one: it carries the retry extension, and Neon
// suspends its compute when idle — which is exactly the state a rarely-run
// maintenance script finds it in.
import { prisma } from '../src/lib/prisma';
import {
  hashPassword,
  assertPasswordStrength,
  PASSWORD_ROLES,
} from '../src/modules/auth/password.service';

/**
 * Readable when spoken, typed, or copied off a screen.
 *
 * The alphabet drops O/0, I/l/1 and similar look-alikes. A generated password
 * is read by a human at least once, and "BinsO0Y88xcNzK7x" — capital O next to
 * a zero — is a password that authenticates perfectly and still cannot be
 * typed. Length carries the strength instead.
 */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
const LOWER = 'abcdefghijkmnpqrstuvwxyz'; // no l, o
const DIGITS = '23456789'; // no 0, 1

const pick = (alphabet: string): string => alphabet[randomInt(0, alphabet.length)]!;

const generate = (): string => {
  const all = UPPER + LOWER + DIGITS;
  // One of each class up front guarantees the strength rules are satisfied.
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < 16) chars.push(pick(all));
  // Fisher-Yates, so the guaranteed characters are not always in front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
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
