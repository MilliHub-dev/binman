import type { Request, Response } from 'express';
import { created, ok } from '../../lib/http';
import { requireUser } from '../../middleware/authenticate';
import { BadRequestError } from '../../lib/errors';
import * as authService from './auth.service';
import { changePassword, loginWithPassword } from './password.service';
import { revokeAllUserTokens, revokeRefreshToken, rotateRefreshToken } from './token.service';
import type {
  ChangePasswordInput,
  CompleteProfileInput,
  PasswordLoginInput,
  RequestOtpInput,
  VerifyOtpInput,
} from './auth.schema';

const clientContext = (req: Request) => ({
  userAgent: req.get('user-agent') ?? null,
  ipAddress: req.ip ?? null,
});

export const requestOtp = async (req: Request, res: Response) => {
  const { phone } = req.body as RequestOtpInput;
  const result = await authService.requestOtp(phone);
  return ok(res, result, 'Verification code sent');
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp } = req.body as VerifyOtpInput;
  const result = await authService.verifyOtpAndLogin(phone, otp, clientContext(req));
  return ok(res, result, 'Signed in successfully');
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };
  const tokens = await rotateRefreshToken(refreshToken, clientContext(req));
  return ok(res, tokens, 'Session refreshed');
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken, allDevices } = req.body as { refreshToken?: string; allDevices: boolean };
  const user = requireUser(req);

  if (allDevices) {
    await revokeAllUserTokens(user.id);
    return ok(res, null, 'Signed out of all devices');
  }

  if (!refreshToken) {
    throw new BadRequestError('refreshToken is required unless allDevices is true', 'REFRESH_TOKEN_REQUIRED');
  }

  await revokeRefreshToken(refreshToken);
  return ok(res, null, 'Signed out');
};

export const completeProfile = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const profile = await authService.completeProfile(user.id, req.body as CompleteProfileInput);
  return created(res, profile, 'Profile saved');
};

/** POST /api/v1/auth/login — email + password, back-office only. */
export const passwordLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body as PasswordLoginInput;
  const result = await loginWithPassword(email, password, clientContext(req));
  return ok(res, result, 'Signed in successfully');
};

/** POST /api/v1/auth/change-password */
export const changeOwnPassword = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  await changePassword(user.id, currentPassword, newPassword);
  return ok(res, null, 'Password updated. Other devices have been signed out.');
};
