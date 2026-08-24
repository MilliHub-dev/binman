import bcrypt from 'bcryptjs';
import { OtpPurpose } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { redis, keys } from '../../lib/redis';
import {
  BadRequestError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../lib/errors';
import { generateOtp } from '../../lib/reference';
import { createLogger } from '../../lib/logger';
import { maskPhone, normalisePhone } from '../../lib/phone';
import { sendSms } from '../../services/sms.service';

const log = createLogger('otp');

const BCRYPT_ROUNDS = 10;

export interface OtpIssueResult {
  expiresAt: Date;
  /** Populated only when OTP_DEBUG_RETURN is on — development convenience. */
  debugCode?: string;
}

/**
 * Issues a one-time code (trsa.md §4).
 *
 * Guarantees:
 *  - the plaintext code is never persisted, only a bcrypt hash
 *  - a short resend cooldown, enforced in Redis
 *  - any previously issued unconsumed code for the number is invalidated, so
 *    only the newest code can ever be redeemed
 */
export const issueOtp = async (
  phone: string,
  purpose: OtpPurpose = OtpPurpose.LOGIN,
): Promise<OtpIssueResult> => {
  const cooldownKey = keys.otpCooldown(phone);

  /**
   * The cooldown is what stops one number triggering an SMS flood, so this
   * path FAILS CLOSED: if Redis cannot be reached we refuse to issue a code
   * rather than issuing an unthrottled one.
   *
   * It surfaces as a 503 rather than a 500 so the cause is legible — this is
   * infrastructure being unavailable, not the caller doing anything wrong.
   */
  let onCooldown: string | null;
  try {
    onCooldown = await redis.get(cooldownKey);
  } catch (err) {
    log.error({ err }, 'redis unavailable — refusing to issue OTP');
    throw new ServiceUnavailableError(
      'We cannot send verification codes right now. Please try again shortly.',
      'OTP_UNAVAILABLE',
    );
  }

  if (onCooldown) {
    const ttl = await redis.ttl(cooldownKey).catch(() => env.OTP_RESEND_COOLDOWN_SECONDS);
    const retryAfterSeconds = Math.max(ttl, 1);
    throw new TooManyRequestsError(
      `Please wait ${retryAfterSeconds} seconds before requesting another code`,
      'OTP_COOLDOWN',
      // Lets the client resync its countdown to the server's rather than
      // guessing, so "Resend code" is never offered a moment too early.
      { retryAfterSeconds },
    );
  }

  /**
   * The store-review account gets a fixed code instead of a random one.
   *
   * Everything else is identical: the code is hashed the same way, expires on
   * the same clock, is consumed once, and the attempt counter and rate limiter
   * both still apply. The only difference is that its value is known in advance
   * — which it has to be, because an App Store reviewer in California cannot
   * receive an SMS on a Nigerian number.
   */
  const isDemoAccount = env.DEMO_PHONE !== '' && phone === normalisePhone(env.DEMO_PHONE);
  const code = isDemoAccount ? env.DEMO_OTP : generateOtp(env.OTP_LENGTH);
  const otpHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  await prisma.$transaction([
    // Supersede outstanding codes so an old SMS cannot be used.
    prisma.otpVerification.updateMany({
      where: { phone, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.otpVerification.create({
      data: { phone, otpHash, purpose, expiresAt },
    }),
  ]);

  // The code is already issued at this point, so a failure here is logged
  // rather than thrown — the DB-backed attempt counter still applies.
  await redis
    .set(cooldownKey, '1', 'EX', env.OTP_RESEND_COOLDOWN_SECONDS)
    .catch((err) => log.error({ err }, 'could not set OTP cooldown'));

  /**
   * No SMS for the review account. Sending one would fail — the number is not
   * a real handset — and a failed send now throws, which would lock a reviewer
   * out of the very account that exists for them.
   */
  if (isDemoAccount) {
    log.warn({ phone: maskPhone(phone) }, 'store-review account signed in with its fixed code');
    return { expiresAt, ...(env.OTP_DEBUG_RETURN ? { debugCode: code } : {}) };
  }

  const sent = await sendSms({
    to: phone,
    message: `Your BinMan verification code is ${code}. It expires in ${Math.round(
      env.OTP_TTL_SECONDS / 60,
    )} minutes. Do not share it with anyone.`,
  });

  /**
   * A rejected send used to be discarded, so the API answered "Verification
   * code sent" for a message the provider had refused — an unregistered sender
   * ID returns 400 on every attempt, and the customer sat waiting for an SMS
   * that was never going to arrive.
   *
   * The cooldown is cleared first: the code exists but nobody can read it, so
   * making them wait out a resend window would punish them for our failure.
   */
  if (!sent.delivered) {
    await redis.del(cooldownKey).catch((err) => log.error({ err }, 'could not clear OTP cooldown'));
    log.error({ phone: maskPhone(phone), error: sent.error }, 'otp sms rejected by provider');
    throw new ServiceUnavailableError(
      'We could not send your code right now. Please try again in a moment.',
      'OTP_SEND_FAILED',
    );
  }

  log.info({ phone: maskPhone(phone), purpose }, 'otp issued');

  return {
    expiresAt,
    ...(env.OTP_DEBUG_RETURN ? { debugCode: code } : {}),
  };
};

/**
 * Verifies a code and burns it. A code is single-use: once consumed it cannot
 * be replayed, even inside its validity window.
 */
export const verifyOtp = async (
  phone: string,
  code: string,
  purpose: OtpPurpose = OtpPurpose.LOGIN,
): Promise<void> => {
  const record = await prisma.otpVerification.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new BadRequestError('No verification code was requested for this number', 'OTP_NOT_FOUND');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    throw new BadRequestError('Verification code has expired. Request a new one.', 'OTP_EXPIRED');
  }

  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    throw new TooManyRequestsError('Too many incorrect attempts. Request a new code.', 'OTP_MAX_ATTEMPTS');
  }

  const matches = await bcrypt.compare(code, record.otpHash);

  if (!matches) {
    const updated = await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const remaining = Math.max(env.OTP_MAX_ATTEMPTS - updated.attempts, 0);
    log.warn({ phone: maskPhone(phone), remaining }, 'otp mismatch');
    throw new UnauthorizedError(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Incorrect code. Request a new one.',
      'OTP_INVALID',
    );
  }

  const now = new Date();
  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verifiedAt: now, consumedAt: now },
  });

  await redis.del(keys.otpCooldown(phone)).catch(() => undefined);
};
