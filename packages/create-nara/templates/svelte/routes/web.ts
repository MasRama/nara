import type { NaraApp } from '@nara-web/core';
import { AuthController } from '../app/controllers/AuthController.js';
import { ProfileController } from '../app/controllers/ProfileController.js';
import { UserController } from '../app/controllers/UserController.js';
import { UploadController } from '../app/controllers/UploadController.js';
import { authMiddleware, webAuthMiddleware, guestMiddleware } from '../app/middlewares/auth.js';
import { wrapHandler } from '../app/utils/route-helper.js';

// Type augmentation for Inertia response
type InertiaResponse = {
  inertia: (component: string, props?: Record<string, any>) => Promise<any>;
};

export function registerRoutes(app: NaraApp) {
  const auth = new AuthController();
  const profile = new ProfileController();
  const users = new UserController();
  const upload = new UploadController();

  // --- Page Routes (Inertia) ---

  // Public
  app.get('/', (req, res: any) => {
    (res as InertiaResponse).inertia('landing', { title: 'Welcome to NARA' });
  });

  // Guest only
  app.get('/login', guestMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('auth/login');
  });
  app.get('/register', guestMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('auth/register');
  });
  app.get('/forgot-password', guestMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('auth/forgot-password');
  });
  app.get('/reset-password/:token', guestMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('auth/reset-password', { token: req.params.token });
  });

  // Protected
  app.get('/dashboard', webAuthMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('dashboard');
  });
  app.get('/users', webAuthMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('users');
  });
  app.get('/profile', webAuthMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('profile');
  });


  // --- API Routes ---

  // Auth
  app.post('/api/auth/login', wrapHandler((req, res) => auth.login(req, res)));
  app.post('/api/auth/register', wrapHandler((req, res) => auth.register(req, res)));
  app.post('/api/auth/logout', wrapHandler((req, res) => auth.logout(req, res)));
  app.post('/api/auth/forgot-password', wrapHandler((req, res) => auth.forgotPassword(req, res)));
  app.post('/api/auth/reset-password', wrapHandler((req, res) => auth.resetPassword(req, res)));
  app.get('/api/auth/me', authMiddleware as any, wrapHandler((req, res) => auth.me(req, res)));

  // Profile
  app.post('/api/profile/update', webAuthMiddleware as any, wrapHandler((req, res) => profile.update(req, res)));
  app.post('/api/profile/password', webAuthMiddleware as any, wrapHandler((req, res) => profile.changePassword(req, res)));
  app.post('/api/profile/avatar', webAuthMiddleware as any, wrapHandler((req, res) => profile.uploadAvatar(req, res)));

  // Users
  app.get('/api/users', webAuthMiddleware as any, wrapHandler((req, res) => users.index(req, res)));
  app.post('/api/users', webAuthMiddleware as any, wrapHandler((req, res) => users.store(req, res)));
  app.put('/api/users/:id', webAuthMiddleware as any, wrapHandler((req, res) => users.update(req, res)));
  app.delete('/api/users', webAuthMiddleware as any, wrapHandler((req, res) => users.destroy(req, res)));

  // Uploads
  app.post('/api/uploads', wrapHandler((req, res) => upload.upload(req, res)));
  app.delete('/api/uploads/:filename', wrapHandler((req, res) => upload.delete(req, res)));

  // Static files
  app.get('/uploads/*', (req, res) => {
    const filePath = req.path.replace('/uploads/', '');
    res.sendFile(`uploads/${filePath}`);
  });
}
