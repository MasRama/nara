import type { NaraApp } from '@nara-web/core';
import { AuthController } from '../app/controllers/AuthController.js';
import { authMiddleware } from '../app/middlewares/auth.js';

export function registerAuthRoutes(app: NaraApp) {
  const auth = new AuthController();

  // Public routes
  app.post('/api/auth/login', (req, res) => auth.login(req, res));
  app.post('/api/auth/register', (req, res) => auth.register(req, res));

  // Protected routes
  app.get('/api/auth/me', authMiddleware, (req, res) => auth.me(req, res));
  app.post('/api/auth/logout', authMiddleware, (req, res) => auth.logout(req, res));
}
