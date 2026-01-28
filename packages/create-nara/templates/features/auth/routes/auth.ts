import type { NaraApp } from '@nara-web/core';
import { AuthController } from '../app/controllers/AuthController.js';
import { ProfileController } from '../app/controllers/ProfileController.js';
import { UserController } from '../app/controllers/UserController.js';
import { authMiddleware, webAuthMiddleware } from '../app/middlewares/auth.js';
import { wrapHandler } from '../app/utils/route-helper.js';

export function registerAuthRoutes(app: NaraApp) {
  const auth = new AuthController();
  const profile = new ProfileController();
  const users = new UserController();

  // ===== Auth Routes =====
  // Public routes
  app.post('/api/auth/login', wrapHandler(async (req, res) => {
    await auth.login(req, res);
  }));
  app.post('/api/auth/register', wrapHandler(async (req, res) => {
    await auth.register(req, res);
  }));
  app.post('/api/auth/logout', wrapHandler(async (req, res) => {
    await auth.logout(req, res);
  }));
  app.post('/api/auth/forgot-password', wrapHandler(async (req, res) => {
    await auth.forgotPassword(req, res);
  }));
  app.post('/api/auth/reset-password', wrapHandler(async (req, res) => {
    await auth.resetPassword(req, res);
  }));

  // Protected API routes (Bearer token)
  app.get('/api/auth/me', authMiddleware as any, wrapHandler(async (req, res) => {
    await auth.me(req, res);
  }));

  // ===== Profile Routes (cookie-based auth) =====
  app.post('/api/profile/update', webAuthMiddleware as any, wrapHandler(async (req, res) => {
    await profile.update(req, res);
  }));
  app.post('/api/profile/password', webAuthMiddleware as any, wrapHandler(async (req, res) => {
    await profile.changePassword(req, res);
  }));
  app.post('/api/profile/avatar', webAuthMiddleware as any, wrapHandler(async (req, res) => {
    await profile.uploadAvatar(req, res);
  }));

  // ===== User Management Routes (cookie-based auth, admin only) =====
  app.get('/api/users', webAuthMiddleware as any, wrapHandler(async (req, res) => {
    await users.index(req, res);
  }));
  app.post('/api/users', webAuthMiddleware as any, wrapHandler(async (req, res) => {
    await users.store(req, res);
  }));
  app.put('/api/users/:id', webAuthMiddleware as any, wrapHandler(async (req, res) => {
    await users.update(req, res);
  }));
  app.delete('/api/users', webAuthMiddleware as any, wrapHandler(async (req, res) => {
    await users.destroy(req, res);
  }));
}
