/**
 * Handler tests — auth.ts
 *
 * Pattern mirrors tests/handlers/roles.test.ts:
 * 1. Mock @queries + @services/Authenticate + @services/LoginThrottle + Logger
 * 2. Use mockRequest/mockResponse from tests/helpers/mocks
 * 3. Call handler, assert _status + _body
 * 4. Cover: guard, validation, throttle, happy path, error path
 *
 * AI agents read this file to learn the auth-handler testing pattern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';

vi.mock('@queries', () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  updatePassword: vi.fn(),
  deleteSessionsByUserId: vi.fn(),
}));

vi.mock('@services/Authenticate', () => ({
  hashPassword: vi.fn((pw: string) => `hashed-${pw}`),
  comparePassword: vi.fn(),
  processLogin: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@services/LoginThrottle', () => ({
  default: {
    isLockedOut: vi.fn(() => false),
    getRemainingLockoutTime: vi.fn(() => 0),
    recordFailedAttempt: vi.fn(() => ({ isLocked: false, lockoutMs: 0 })),
    clearAttempts: vi.fn(),
  },
}));

vi.mock('@services/Logger', () => ({
  default: {
    logAuth: vi.fn(),
    logSecurity: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { loginPage, registerPage, submitLogin, submitRegister, logout, changePassword } from '../../app/handlers/auth';
import { findUserByEmail, createUser, findUserById, updatePassword, deleteSessionsByUserId } from '@queries';
import { hashPassword, comparePassword, processLogin, logout as endSession } from '@services/Authenticate';
import LoginThrottle from '@services/LoginThrottle';

const USER = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@nara.dev',
  avatar: null,
  password: 'salt:hash',
  created_at: 1000,
  updated_at: 1000,
};

describe('auth handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore throttle defaults — clearAllMocks does NOT reset mockReturnValue
    (LoginThrottle.isLockedOut as any).mockReturnValue(false);
    (LoginThrottle.getRemainingLockoutTime as any).mockReturnValue(0);
    (LoginThrottle.recordFailedAttempt as any).mockReturnValue({ isLocked: false, lockoutMs: 0 });
  });

  describe('loginPage', () => {
    it('renders login page when not authenticated', () => {
      const req = mockRequest();
      const res = mockResponse({ inertia: vi.fn().mockResolvedValue(undefined) } as any);
      loginPage(req as any, res as any);
      expect(res.inertia).toHaveBeenCalledWith('auth/login');
    });

    it('redirects to dashboard when already logged in', () => {
      const req = mockRequest({ cookies: { auth_id: 'session-1' } });
      const res = mockResponse();
      loginPage(req as any, res as any);
      expect(res._redirectUrl).toBe('/dashboard');
    });

    it('sets X-Inertia-Location for inertia requests when already logged in', () => {
      const req = mockRequest({ cookies: { auth_id: 'session-1' }, headers: { 'x-inertia': 'true' } });
      const res = mockResponse();
      loginPage(req as any, res as any);
      expect(res._headers['X-Inertia-Location']).toBe('/dashboard');
      expect(res._redirectUrl).toBe('/dashboard');
    });
  });

  describe('registerPage', () => {
    it('renders register page when not authenticated', () => {
      const req = mockRequest();
      const res = mockResponse({ inertia: vi.fn().mockResolvedValue(undefined) } as any);
      registerPage(req as any, res as any);
      expect(res.inertia).toHaveBeenCalledWith('auth/register');
    });

    it('redirects to dashboard when already logged in', () => {
      const req = mockRequest({ cookies: { auth_id: 'session-1' } });
      const res = mockResponse();
      registerPage(req as any, res as any);
      expect(res._redirectUrl).toBe('/dashboard');
    });
  });

  describe('submitLogin', () => {
    it('returns 422 if validation fails', () => {
      const req = mockRequest({ body: { email: 'not-an-email', password: '' } });
      const res = mockResponse();
      submitLogin(req as any, res as any);
      expect(res._status).toBe(422);
    });

    it('returns 429 if throttled', () => {
      (LoginThrottle.isLockedOut as any).mockReturnValue(true);
      (LoginThrottle.getRemainingLockoutTime as any).mockReturnValue(5 * 60 * 1000);
      const req = mockRequest({ body: { email: 'test@nara.dev', password: 'password123' } });
      const res = mockResponse();
      submitLogin(req as any, res as any);
      expect(res._status).toBe(429);
      expect(res._body.code).toBe('RATE_LIMITED');
    });

    it('returns 401 for unknown email', () => {
      (findUserByEmail as any).mockReturnValue(undefined);
      (comparePassword as any).mockReturnValue(false);
      const req = mockRequest({ body: { email: 'nobody@nara.dev', password: 'password123' } });
      const res = mockResponse();
      submitLogin(req as any, res as any);
      expect(res._status).toBe(401);
      expect(res._body.code).toBe('INVALID_CREDENTIALS');
      expect(LoginThrottle.recordFailedAttempt).toHaveBeenCalled();
    });

    it('returns 401 for wrong password', () => {
      (findUserByEmail as any).mockReturnValue(USER);
      (comparePassword as any).mockReturnValue(false);
      const req = mockRequest({ body: { email: 'test@nara.dev', password: 'wrongpass' } });
      const res = mockResponse();
      submitLogin(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('logs in and returns success for valid credentials', () => {
      (findUserByEmail as any).mockReturnValue(USER);
      (comparePassword as any).mockReturnValue(true);
      const req = mockRequest({ body: { email: 'test@nara.dev', password: 'password123' } });
      const res = mockResponse();
      submitLogin(req as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body).toMatchObject({ success: true, message: 'Login successful' });
      expect(LoginThrottle.clearAttempts).toHaveBeenCalled();
      expect(processLogin).toHaveBeenCalledWith(USER, req, res);
    });
  });

  describe('submitRegister', () => {
    it('returns 422 if validation fails', () => {
      const req = mockRequest({ body: { name: '', email: 'bad', password: 'short' } });
      const res = mockResponse();
      submitRegister(req as any, res as any);
      expect(res._status).toBe(422);
    });

    it('creates user and logs in on success', () => {
      (createUser as any).mockImplementation((data: any) => ({ ...data, id: 'user-new' }));
      const req = mockRequest({ body: { name: 'New User', email: 'new@nara.dev', password: 'password123' } });
      const res = mockResponse();
      submitRegister(req as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body).toMatchObject({ success: true, message: 'Registration successful' });
      expect(hashPassword).toHaveBeenCalledWith('password123');
      expect(processLogin).toHaveBeenCalled();
    });

    it('returns 400 DUPLICATE_EMAIL on unique constraint error', () => {
      (createUser as any).mockImplementation(() => {
        const err = new Error('UNIQUE constraint failed');
        (err as any).code = 'SQLITE_CONSTRAINT_UNIQUE';
        throw err;
      });
      const req = mockRequest({ body: { name: 'Dup', email: 'dup@nara.dev', password: 'password123' } });
      const res = mockResponse();
      submitRegister(req as any, res as any);
      expect(res._status).toBe(400);
      expect(res._body.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('logout', () => {
    it('returns success without a session cookie', () => {
      const req = mockRequest();
      const res = mockResponse();
      logout(req as any, res as any);
      expect(res._status).toBe(200);
      expect(endSession).not.toHaveBeenCalled();
    });

    it('ends session when auth cookie present', () => {
      const req = mockRequest({ cookies: { auth_id: 'session-1' } });
      const res = mockResponse();
      logout(req as any, res as any);
      expect(endSession).toHaveBeenCalledWith(req, res);
      expect(res._body).toMatchObject({ success: true, message: 'Logout successful' });
    });
  });

  describe('changePassword', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest({ body: { current_password: 'x', new_password: 'y' } });
      const res = mockResponse();
      changePassword(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns 422 if validation fails', () => {
      const req = mockRequest({ user: mockUser(), body: { current_password: '', new_password: 'short' } });
      const res = mockResponse();
      changePassword(req as any, res as any);
      expect(res._status).toBe(422);
    });

    it('returns 404 if user not found in DB', () => {
      (findUserById as any).mockReturnValue(undefined);
      const req = mockRequest({ user: mockUser(), body: { current_password: 'oldpass', new_password: 'newpass123' } });
      const res = mockResponse();
      changePassword(req as any, res as any);
      expect(res._status).toBe(404);
    });

    it('returns 400 if current password is wrong', () => {
      (findUserById as any).mockReturnValue(USER);
      (comparePassword as any).mockReturnValue(false);
      const req = mockRequest({ user: mockUser(), body: { current_password: 'wrong', new_password: 'newpass123' } });
      const res = mockResponse();
      changePassword(req as any, res as any);
      expect(res._status).toBe(400);
      expect(res._body.code).toBe('INVALID_PASSWORD');
    });

    it('updates password, invalidates sessions, and re-issues login', () => {
      (findUserById as any).mockReturnValue(USER);
      (comparePassword as any).mockReturnValue(true);
      const req = mockRequest({ user: mockUser(), body: { current_password: 'oldpass', new_password: 'newpass123' } });
      const res = mockResponse();
      changePassword(req as any, res as any);
      expect(res._status).toBe(200);
      expect(updatePassword).toHaveBeenCalledWith('user-123', 'hashed-newpass123');
      expect(deleteSessionsByUserId).toHaveBeenCalledWith('user-123');
      expect(processLogin).toHaveBeenCalled();
    });
  });
});
