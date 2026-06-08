import type { NaraRequest, NaraResponse } from '@core';
import { inertia, jsonError } from '@core';
import { hashPassword, comparePassword, processLogin as loginSession, logout as endSession } from '@services/Authenticate';
import LoginThrottle from '@services/LoginThrottle';
import Logger from '@services/Logger';
import { findUserByEmailOrPhone, createUser, findUserById, updatePassword } from '@queries';
import { randomUUID } from 'crypto';
import { AUTH, ERROR_MESSAGES } from '@config';
import { LoginSchema, RegisterSchema, ChangePasswordSchema, zodToErrors } from '@validators';

const inertiaError = (res: NaraResponse, message: string, redirectTo: string) =>
  res.cookie('error', message, { maxAge: AUTH.ERROR_COOKIE_EXPIRY_MS }).redirect(redirectTo);

export const loginPage = (req: NaraRequest, res: NaraResponse) => {
  if (req.cookies.auth_id) {
    const isI = req.headers['x-inertia'];
    if (isI) return res.setHeader('X-Inertia-Location', '/dashboard').redirect('/dashboard');
    return res.redirect('/dashboard');
  }
  return inertia(res).inertia('auth/login');
};

export const registerPage = (req: NaraRequest, res: NaraResponse) => {
  if (req.cookies.auth_id) {
    const isI = req.headers['x-inertia'];
    if (isI) return res.setHeader('X-Inertia-Location', '/dashboard').redirect('/dashboard');
    return res.redirect('/dashboard');
  }
  return inertia(res).inertia('auth/register');
};

export const processLogin = (req: NaraRequest, res: NaraResponse) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = zodToErrors(parsed.error);
    const msg = Object.values(errors).flat().join(', ');
    return inertiaError(res, msg, '/login');
  }

  const { email, phone, password } = parsed.data;
  const identifier = email || phone || '';
  const ip = req.ip || 'unknown';

  if (LoginThrottle.isLockedOut(identifier, ip)) {
    const mins = Math.ceil(LoginThrottle.getRemainingLockoutTime(identifier, ip) / 60000);
    Logger.logSecurity('Login blocked - locked', { identifier, ip });
    return res.status(429)
      .cookie('error', `Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.`, { maxAge: AUTH.ERROR_COOKIE_EXPIRY_MS })
      .redirect('/login');
  }

  const user = findUserByEmailOrPhone(email, phone);

  if (!user) {
    const result = LoginThrottle.recordFailedAttempt(identifier, ip);
    Logger.logSecurity('Login failed - not found', { identifier, ip });
    const msg = result.isLocked
      ? `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(result.lockoutMs / 60000)} menit.`
      : ERROR_MESSAGES.INVALID_CREDENTIALS;
    return inertiaError(res, msg, '/login');
  }

  const valid = comparePassword(password, user.password);

  if (valid) {
    LoginThrottle.clearAttempts(identifier, ip);
    Logger.logAuth('login_success', { userId: user.id, ip });
    return loginSession(user, req, res);
  }

  const result = LoginThrottle.recordFailedAttempt(identifier, ip);
  Logger.logSecurity('Login failed - bad password', { userId: user.id, ip });
  const msg = result.isLocked
    ? `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(result.lockoutMs / 60000)} menit.`
    : ERROR_MESSAGES.INVALID_CREDENTIALS;
  return inertiaError(res, msg, '/login');
};

export const processRegister = (req: NaraRequest, res: NaraResponse) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = zodToErrors(parsed.error);
    const msg = Object.values(errors).flat().join(', ');
    return inertiaError(res, msg, '/register');
  }

  const { name, email, phone, password } = parsed.data;

  try {
    const user = createUser({
      id: randomUUID(),
      name,
      email,
      phone: phone || null,
      password: hashPassword(password),
    });

    Logger.logAuth('registration_success', { userId: user.id, ip: req.ip });
    return loginSession(user, req, res);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      Logger.logSecurity('Registration failed - duplicate', { email, ip: req.ip });
      return inertiaError(res, ERROR_MESSAGES.EMAIL_EXISTS, '/register');
    }
    throw error;
  }
};

export const logout = (req: NaraRequest, res: NaraResponse) => {
  if (req.cookies.auth_id) {
    endSession(req, res);
  }
};

export const changePassword = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return res.redirect('/login');

  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = zodToErrors(parsed.error);
    const msg = Object.values(errors).flat().join(', ');
    return inertiaError(res, msg, '/profile');
  }

  const { current_password, new_password } = parsed.data;

  const dbUser = findUserById(req.user.id);
  if (!dbUser) return res.redirect('/login');

  const valid = comparePassword(current_password, dbUser.password);
  if (!valid) {
    return inertiaError(res, 'Password saat ini tidak valid', '/profile');
  }

  updatePassword(req.user.id, hashPassword(new_password));
  Logger.logAuth('password_changed', { userId: req.user.id, ip: req.ip });

  return res.cookie('success', 'Password berhasil diubah', { maxAge: AUTH.ERROR_COOKIE_EXPIRY_MS }).redirect('/profile');
};
