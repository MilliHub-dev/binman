import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import {
  otpRequestLimiter,
  otpVerifyLimiter,
  passwordLoginLimiter,
  strictLimiter,
} from '../../middleware/rateLimit';
import * as controller from './auth.controller';
import {
  changePasswordSchema,
  completeProfileSchema,
  passwordLoginSchema,
  logoutSchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from './auth.schema';

export const authRouter: Router = Router();

/** POST /api/v1/auth/request-otp — send a login code. */
authRouter.post('/request-otp', otpRequestLimiter, validate({ body: requestOtpSchema }), controller.requestOtp);

/** POST /api/v1/auth/verify-otp — exchange a code for tokens; registers on first use. */
authRouter.post('/verify-otp', otpVerifyLimiter, validate({ body: verifyOtpSchema }), controller.verifyOtp);

/**
 * POST /api/v1/auth/login — staff sign-in with email and password.
 * Customers and drivers use the OTP routes above; this one is role-gated.
 */
authRouter.post(
  '/login',
  passwordLoginLimiter,
  validate({ body: passwordLoginSchema }),
  controller.passwordLogin,
);

/** POST /api/v1/auth/change-password */
authRouter.post(
  '/change-password',
  authenticate,
  strictLimiter,
  validate({ body: changePasswordSchema }),
  controller.changeOwnPassword,
);

/** POST /api/v1/auth/refresh — rotate a refresh token. */
authRouter.post('/refresh', strictLimiter, validate({ body: refreshSchema }), controller.refresh);

/** POST /api/v1/auth/logout */
authRouter.post('/logout', authenticate, validate({ body: logoutSchema }), controller.logout);

/** POST /api/v1/auth/complete-profile — the profile-setup screen. */
authRouter.post(
  '/complete-profile',
  authenticate,
  validate({ body: completeProfileSchema }),
  controller.completeProfile,
);
