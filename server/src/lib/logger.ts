import pino from 'pino';
import { env, isDevelopment } from '../config/env';

/**
 * Fields that must never reach the log stream (trsa.md §13). Redaction is
 * applied by path, so anything nested under these keys is masked too.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["verif-hash"]',
  'req.headers["x-hub-signature-256"]',
  'req.body.otp',
  'req.body.password',
  'req.body.token',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
  'otp',
  'otpHash',
  'password',
  'accessToken',
  'refreshToken',
  'tokenHash',
  '*.otp',
  '*.accessToken',
  '*.refreshToken',
  'secretKey',
  'FLUTTERWAVE_SECRET_KEY',
  'WHATSAPP_ACCESS_TOKEN',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
  base: { service: 'binman-api', env: env.NODE_ENV },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service,env' },
      }
    : undefined,
});

/** Child logger tagged with a subsystem name, e.g. `logger.child({ module })`. */
export const createLogger = (module: string) => logger.child({ module });
