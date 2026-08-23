import { api } from './client';
import type { AuthSession, RequestOtpResult, User } from './types';

/** Auth endpoints. Phone + OTP is the only sign-in the platform has. */

export const requestOtp = (phone: string) =>
  api.post<RequestOtpResult>('/auth/request-otp', { phone }, { skipAuth: true });

export const verifyOtp = (phone: string, otp: string) =>
  api.post<AuthSession>('/auth/verify-otp', { phone, otp }, { skipAuth: true });

export const completeProfile = (input: {
  firstName: string;
  lastName: string;
  email?: string;
}) => api.post<User>('/auth/complete-profile', input);

export const logout = (refreshToken: string) => api.post<null>('/auth/logout', { refreshToken });

export const me = () => api.get<User>('/users/me');
