import type { NaraRequest, NaraResponse } from '@core';
import { jsonSuccess, jsonError, jsonValidationError, isUniqueConstraintError } from '@core';
import { hashPassword, comparePassword, processLogin as loginSession, logout as endSession } from '@services/Authenticate';
import LoginThrottle from '@services/LoginThrottle';
import Logger from '@services/Logger';
import { findUserByEmail, createUser, findUserById, updatePassword, deleteSessionsByUserId } from '@queries';
import { randomUUID } from 'crypto';
import { LoginSchema, RegisterSchema, ChangePasswordSchema, zodToErrors } from '@validators';

export const loginPage = (req: NaraRequest, res: NaraResponse) => {
  if (req.cookies.auth_id) {
    const isI = req.headers['x-inertia'];
    if (isI) return res.setHeader('X-Inertia-Location', '/dashboard').redirect('/dashboard');
    return res.redirect('/dashboard');
  }
  return res.inertia('auth/login');
};

export const registerPage = (req: NaraRequest, res: NaraResponse) => {
  if (req.cookies.auth_id) {
    const isI = req.headers['x-inertia'];
    if (isI) return res.setHeader('X-Inertia-Location', '/dashboard').redirect('/dashboard');
    return res.redirect('/dashboard');
  }
  return res.inertia('auth/register');
};

export const processLogin = (req: NaraRequest, res: NaraResponse) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = zodToErrors(parsed.error);
    const msg = Object.values(errors).flat().join(', ');
    return jsonValidationError(res, msg, errors);
  }

  const { email, password } = parsed.data;
  const identifier = email;
  const ip = req.ip || 'unknown';

  if (LoginThrottle.isLockedOut(identifier, ip)) {
    const mins = Math.ceil(LoginThrottle.getRemainingLockoutTime(identifier, ip) / 60000);
    Logger.logSecurity('Login blocked - locked', { identifier, ip });
    return jsonError(res, `Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.`, 429, 'RATE_LIMITED');
  }

  const user = findUserByEmail(email);

  // Always run password comparison to prevent timing-based user enumeration
  // Format: salt:hash (PBKDF2-SHA512, 100k iterations, 64-byte key)
  const DUMMY_HASH = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:' + '0'.repeat(128);
  const valid = user ? comparePassword(password, user.password) : comparePassword(password, DUMMY_HASH);

  if (!user || !valid) {
    const result = LoginThrottle.recordFailedAttempt(identifier, ip);
    Logger.logSecurity('Login failed', { identifier, ip, reason: user ? 'bad_password' : 'not_found' });
    const msg = result.isLocked
      ? `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(result.lockoutMs / 60000)} menit.`
      : 'Email atau password salah';
    return jsonError(res, msg, 401, 'INVALID_CREDENTIALS');
  }

  LoginThrottle.clearAttempts(identifier, ip);
  Logger.logAuth('login_success', { userId: user.id, ip });
  loginSession(user, req, res);
  return jsonSuccess(res, 'Login berhasil');
};

export const processRegister = (req: NaraRequest, res: NaraResponse) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = zodToErrors(parsed.error);
    const msg = Object.values(errors).flat().join(', ');
    return jsonValidationError(res, msg, errors);
  }

  const { name, email, password } = parsed.data;

  try {
    const user = createUser({
      id: randomUUID(),
      name,
      email,
      password: hashPassword(password),
    });

    Logger.logAuth('registration_success', { userId: user.id, ip: req.ip });
    loginSession(user, req, res);
    return jsonSuccess(res, 'Registrasi berhasil');
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      Logger.logSecurity('Registration failed - duplicate', { email, ip: req.ip });
      return jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL');
    }
    throw error;
  }
};

export const logout = (req: NaraRequest, res: NaraResponse) => {
  if (req.cookies.auth_id) {
    endSession(req, res);
  }
  return jsonSuccess(res, 'Logout berhasil');
};

export const changePassword = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = zodToErrors(parsed.error);
    const msg = Object.values(errors).flat().join(', ');
    return jsonValidationError(res, msg, errors);
  }

  const { current_password, new_password } = parsed.data;

  const dbUser = findUserById(req.user.id);
  if (!dbUser) return jsonError(res, 'User tidak ditemukan', 404);

  const valid = comparePassword(current_password, dbUser.password);
  if (!valid) {
    return jsonError(res, 'Password saat ini tidak valid', 400, 'INVALID_PASSWORD');
  }

  updatePassword(req.user.id, hashPassword(new_password));
  // Invalidate all other sessions (force re-login on other devices)
  deleteSessionsByUserId(req.user.id);
  // Re-issue session for current request so user stays logged in
  loginSession(dbUser, req, res);
  Logger.logAuth('password_changed', { userId: req.user.id, ip: req.ip });

  return jsonSuccess(res, 'Password berhasil diubah');
};
