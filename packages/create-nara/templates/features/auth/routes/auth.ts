import type { NaraApp } from '@nara-web/core';
import { AuthController } from '../app/controllers/AuthController.js';
import { authMiddleware } from '../app/middlewares/auth.js';

export function registerAuthRoutes(app: NaraApp) {
  const auth = new AuthController();

  // Public routes
  app.post('/api/auth/login', async (req, res) => {
    await auth.login(req, res);
  });
  app.post('/api/auth/register', async (req, res) => {
    await auth.register(req, res);
  });
  // Logout is public - just clears the cookie
  app.post('/api/auth/logout', async (req, res) => {
    await auth.logout(req, res);
  });

  // Protected API routes (Bearer token)
  app.get('/api/auth/me', authMiddleware as any, async (req, res) => {
    await auth.me(req, res);
  });
}
