import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment is parsed once, at boot, and the process exits if anything is
 * missing or malformed. Nothing downstream needs to defend against undefined
 * config, and a misconfigured deployment fails loudly instead of at 3am.
 */

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const csv = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_BASE_URL: z.string().url().default('http://localhost:4000'),
    // 'silent' is a real pino level — it disables logging entirely, which is
    // what a test run wants.
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    /**
     * Browser origins allowed to call the API.
     *
     * Defaults cover the local surfaces: 3000 marketing + driver PWA,
     * 3001 admin console. The mobile app is not a browser and sends no Origin,
     * so it is unaffected by this list.
     */
    CORS_ORIGINS: csv.default('http://localhost:3000,http://localhost:3001'),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    /**
     * How long a single Redis command may take before it is abandoned.
     *
     * The default suits a HOSTED Redis (Upstash and similar) reached over TLS
     * from another region, where the first command after connect routinely
     * takes over a second. A local Redis answers in single-digit milliseconds
     * and can be tightened right down.
     */
    REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('30d'),

    OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
    OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
    OTP_DEBUG_RETURN: bool.default('false'),

    /**
     * A single account App Store and Play Store reviewers can sign into.
     *
     * Reviewers sit outside Nigeria and cannot receive an SMS on a Nigerian
     * number, so a store submission that only offers phone-code sign-in is
     * rejected as untestable. This whitelists exactly one number to receive a
     * fixed code instead of a random one.
     *
     * It is a deliberate back door, so it is narrow: one number, one code, and
     * nothing else about the flow changes — the code is still hashed, still
     * expires, still single-use, and the rate limiter still applies. Unset both
     * values and it does not exist.
     */
    DEMO_PHONE: z.string().default(''),
    DEMO_OTP: z.string().default(''),

    CURRENCY: z.string().length(3).default('NGN'),
    DEFAULT_SERVICE_FEE: z.coerce.number().int().nonnegative().default(50000),

    CANCELLATION_WINDOW_HOURS: z.coerce.number().int().nonnegative().default(2),
    MAX_ADVANCE_BOOKING_DAYS: z.coerce.number().int().positive().default(30),
    PAYMENT_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),

    FLUTTERWAVE_BASE_URL: z.string().url().default('https://api.flutterwave.com/v3'),
    FLUTTERWAVE_PUBLIC_KEY: z.string().default(''),
    FLUTTERWAVE_SECRET_KEY: z.string().default(''),
    FLUTTERWAVE_ENCRYPTION_KEY: z.string().default(''),
    FLUTTERWAVE_WEBHOOK_SECRET_HASH: z.string().default(''),
    FLUTTERWAVE_REDIRECT_URL: z.string().url().default('http://localhost:3000/payments/callback'),

    WHATSAPP_ENABLED: bool.default('false'),
    WHATSAPP_API_URL: z.string().url().default('https://graph.facebook.com/v21.0'),
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
    WHATSAPP_ACCESS_TOKEN: z.string().default(''),
    WHATSAPP_VERIFY_TOKEN: z.string().default(''),
    WHATSAPP_APP_SECRET: z.string().default(''),
    WHATSAPP_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(1800),

    // Sendchamp handles both SMS and email.
    SMS_PROVIDER: z.enum(['log', 'sendchamp']).default('log'),
    EMAIL_PROVIDER: z.enum(['log', 'sendchamp']).default('log'),
    SENDCHAMP_BASE_URL: z.string().url().default('https://api.sendchamp.com/api/v1'),
    SENDCHAMP_PUBLIC_KEY: z.string().default(''),
    SENDCHAMP_SENDER_NAME: z.string().default('BinMan'),
    /**
     * Nigerian networks require DND-registered routing to reach subscribers who
     * have opted out of promotional SMS. OTPs are transactional, so `dnd` is
     * the correct route for them.
     */
    SENDCHAMP_SMS_ROUTE: z.enum(['non_dnd', 'dnd', 'international']).default('dnd'),
    SENDCHAMP_FROM_EMAIL: z.string().default('no-reply@binman.ng'),
    SENDCHAMP_FROM_NAME: z.string().default('BinMan'),
    /**
     * Shared secret for the delivery-status webhook. When set, callbacks must
     * present it or they are rejected. Leave empty to accept unverified
     * callbacks — acceptable in development only, since the endpoint can do
     * nothing worse than mark a notification delivered.
     */
    SENDCHAMP_WEBHOOK_SECRET: z.string().default(''),

    PUSH_PROVIDER: z.enum(['log', 'fcm']).default('log'),
    /** All three come from one Firebase service-account JSON — see .env.example. */
    FCM_PROJECT_ID: z.string().default(''),
    FCM_CLIENT_EMAIL: z.string().default(''),
    /**
     * The PEM private key from the service account.
     *
     * The JSON stores newlines as the two characters `\` + `n`, and .env files
     * cannot hold real newlines unquoted — so the value arrives escaped and
     * would fail to parse as a PEM. Unescaping here means no caller has to
     * remember this. Surrounding quotes are stripped for the same reason.
     */
    FCM_PRIVATE_KEY: z
      .string()
      .default('')
      .transform((value) => value.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n')),

    STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('uploads'),
    STORAGE_PUBLIC_URL: z.string().default('http://localhost:4000/uploads'),
    CLOUDINARY_CLOUD_NAME: z.string().default(''),
    CLOUDINARY_API_KEY: z.string().default(''),
    CLOUDINARY_API_SECRET: z.string().default(''),
    /** Prefix for every uploaded asset, so one account can host several envs. */
    CLOUDINARY_FOLDER: z.string().default('binman'),

    MAPBOX_ACCESS_TOKEN: z.string().default(''),
    /** Biases geocoding toward the market we operate in. */
    MAPBOX_COUNTRY: z.string().default('ng'),
  })
  .superRefine((env, ctx) => {
    const isProdLike = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';

    // Half a configuration is the dangerous state: a whitelisted number with no
    // fixed code would fall through to a real one nobody can receive.
    if (Boolean(env.DEMO_PHONE) !== Boolean(env.DEMO_OTP)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEMO_PHONE'],
        message: 'DEMO_PHONE and DEMO_OTP must be set together, or neither',
      });
    }

    if (env.DEMO_OTP && env.DEMO_OTP.length !== env.OTP_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEMO_OTP'],
        message: `DEMO_OTP must be exactly ${env.OTP_LENGTH} digits to match OTP_LENGTH`,
      });
    }

    if (env.DEMO_OTP && !/^\d+$/.test(env.DEMO_OTP)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEMO_OTP'],
        message: 'DEMO_OTP must be digits only — the app offers a numeric keypad',
      });
    }

    // Returning the OTP in an API response is a development affordance. Letting
    // it reach a real deployment would hand every account to anyone who knows
    // a phone number.
    if (isProdLike && env.OTP_DEBUG_RETURN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OTP_DEBUG_RETURN'],
        message: 'OTP_DEBUG_RETURN must be false outside development',
      });
    }

    /**
     * The log driver writes the message to stdout and reports `delivered: true`,
     * so a deployment left on it sends no OTPs at all while every layer above
     * reports success — the customer simply never receives a code, and nothing
     * anywhere is logged as an error. Refusing to boot is the only way this
     * surfaces before a real person is locked out.
     */
    if (isProdLike && env.SMS_PROVIDER === 'log') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMS_PROVIDER'],
        message:
          'SMS_PROVIDER must be a real provider outside development — "log" sends nothing while reporting success',
      });
    }

    // Sendchamp authenticates with the public key; without it every send 401s.
    if (
      (env.SMS_PROVIDER === 'sendchamp' || env.EMAIL_PROVIDER === 'sendchamp') &&
      !env.SENDCHAMP_PUBLIC_KEY
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SENDCHAMP_PUBLIC_KEY'],
        message: 'SENDCHAMP_PUBLIC_KEY is required when a Sendchamp provider is selected',
      });
    }

    if (isProdLike && !env.FLUTTERWAVE_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FLUTTERWAVE_SECRET_KEY'],
        message: 'FLUTTERWAVE_SECRET_KEY is required outside development',
      });
    }

    // Without the secret hash we cannot tell a genuine Flutterwave callback
    // from anyone who can POST to the webhook URL.
    if (isProdLike && !env.FLUTTERWAVE_WEBHOOK_SECRET_HASH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FLUTTERWAVE_WEBHOOK_SECRET_HASH'],
        message: 'FLUTTERWAVE_WEBHOOK_SECRET_HASH is required outside development',
      });
    }

    if (env.WHATSAPP_ENABLED && !env.WHATSAPP_ACCESS_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WHATSAPP_ACCESS_TOKEN'],
        message: 'WHATSAPP_ACCESS_TOKEN is required when WHATSAPP_ENABLED=true',
      });
    }

    // A half-configured FCM setup fails silently at send time, by which point
    // the notification is already lost. Catch it at boot instead.
    if (env.PUSH_PROVIDER === 'fcm') {
      for (const key of ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when PUSH_PROVIDER=fcm`,
          });
        }
      }
      if (env.FCM_PRIVATE_KEY && !env.FCM_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FCM_PRIVATE_KEY'],
          message:
            'FCM_PRIVATE_KEY does not look like a PEM key. Copy the whole private_key value from the service-account JSON, including the BEGIN/END lines.',
        });
      }
    }

    /**
     * Secrets that were never changed from their development values.
     *
     * Being non-empty is not the same as being secret. A JWT signing key left
     * at "dev-access-secret-…" lets anyone who has seen this repository mint a
     * token for any account, administrators included; a webhook hash left at
     * "replace-me" lets anyone forge a payment callback and get free service.
     * Both pass every other check here, so they are matched by shape.
     */
    if (isProdLike) {
      const placeholder = /^(replace|change)[-_ ]?me$|^(dev|test|local|sample|example|placeholder)[-_]/i;
      const secrets = [
        ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
        ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
        ['FLUTTERWAVE_WEBHOOK_SECRET_HASH', env.FLUTTERWAVE_WEBHOOK_SECRET_HASH],
        ...(env.WHATSAPP_ENABLED ? [['WHATSAPP_VERIFY_TOKEN', env.WHATSAPP_VERIFY_TOKEN]] : []),
      ] as const;

      for (const [name, value] of secrets) {
        if (value && placeholder.test(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name],
            message: `${name} is still a development placeholder — generate a real secret before deploying`,
          });
        }
      }

      for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (env[name].length < 32) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name],
            message: `${name} must be at least 32 characters in production`,
          });
        }
      }
    }

    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Logger depends on env, so this one case has to use console.
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export type Env = typeof env;
