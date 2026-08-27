import { env } from '../config/env';
import { createLogger } from '../lib/logger';
import { maskPhone } from '../lib/phone';
import { describeSendchampError, isAccepted, sendchamp } from './sendchamp.client';
import { sendSms } from './sms.service';

const log = createLogger('otp.delivery');

/**
 * How a verification code reaches the customer.
 *
 * WhatsApp is close to universal in Nigeria and costs a fraction of an SMS, so
 * it is worth trying first — but it is not a superset of SMS, and the fallback
 * below is deliberate rather than decorative.
 *
 * The code itself is still ours. Sendchamp's verification endpoint will
 * generate a token if you let it, which would move OTP generation off our
 * CSPRNG and out of our control; passing `token` explicitly means it only
 * carries the code we already hashed and stored.
 */
export type OtpChannel = 'sms' | 'whatsapp';

export interface OtpDeliveryResult {
  delivered: boolean;
  /** Which channel actually carried it, for the log and for support. */
  channel?: OtpChannel;
  error?: string;
}

const message = (code: string): string =>
  `Your BinMan verification code is ${code}. It expires in ${Math.round(
    env.OTP_TTL_SECONDS / 60,
  )} minutes. Do not share it with anyone.`;

/**
 * WhatsApp, via Sendchamp's verification endpoint.
 *
 * That endpoint is the only WhatsApp route open to this account: the direct
 * message API needs a WhatsApp Business sender number provisioned on the
 * account, and without one it answers "unable to get sender number". The
 * verification endpoint uses Sendchamp's own sender instead.
 */
const viaWhatsApp = async (phone: string, code: string): Promise<OtpDeliveryResult> => {
  try {
    const { data } = await sendchamp().post('/verification/create', {
      channel: 'whatsapp',
      sender: env.SENDCHAMP_SENDER_NAME,
      token_type: 'numeric',
      token_length: code.length,
      // Their expiry is in minutes and is advisory — ours is enforced against
      // the stored record, which is the one that actually decides.
      expiration_time: Math.max(1, Math.round(env.OTP_TTL_SECONDS / 60)),
      customer_mobile_number: phone.replace(/^\+/, ''),
      token: code,
    });

    if (!isAccepted(data)) {
      const error = (data as { message?: string })?.message ?? 'WhatsApp delivery refused';
      return { delivered: false, error };
    }

    return { delivered: true, channel: 'whatsapp' };
  } catch (err) {
    return { delivered: false, error: describeSendchampError(err) };
  }
};

const viaSms = async (phone: string, code: string): Promise<OtpDeliveryResult> => {
  const sent = await sendSms({ to: phone, message: message(code) });
  return sent.delivered
    ? { delivered: true, channel: 'sms' }
    : { delivered: false, error: sent.error };
};

/**
 * Delivers a code on the configured channel, falling back where asked.
 *
 * The fallback catches a refusal from the provider — an unregistered sender, a
 * malformed number, an outage. It does NOT catch a number that simply has no
 * WhatsApp account: Sendchamp accepts those and reports success, so a code sent
 * to one vanishes silently. That is the reason `whatsapp` alone is a poor
 * default, and why `whatsapp_then_sms` is not a guarantee either.
 */
export const deliverOtp = async (phone: string, code: string): Promise<OtpDeliveryResult> => {
  const masked = maskPhone(phone);

  if (env.OTP_CHANNEL === 'sms') return viaSms(phone, code);

  const whatsapp = await viaWhatsApp(phone, code);
  if (whatsapp.delivered) {
    log.info({ phone: masked, channel: 'whatsapp' }, 'otp delivered');
    return whatsapp;
  }

  if (env.OTP_CHANNEL === 'whatsapp') {
    log.error({ phone: masked, error: whatsapp.error }, 'whatsapp otp refused');
    return whatsapp;
  }

  log.warn({ phone: masked, error: whatsapp.error }, 'whatsapp otp refused — falling back to sms');
  const sms = await viaSms(phone, code);
  if (sms.delivered) log.info({ phone: masked, channel: 'sms' }, 'otp delivered by fallback');
  return sms;
};
