import type { NaraApp } from '@nara-web/core';
import { AuthController } from '../app/controllers/AuthController.js';
import { ProfileController } from '../app/controllers/ProfileController.js';
import { UserController } from '../app/controllers/UserController.js';
import { UploadController } from '../app/controllers/UploadController.js';
import { authMiddleware, webAuthMiddleware, guestMiddleware } from '../app/middlewares/auth.js';
import { wrapHandler } from '../app/utils/route-helper.js';
import { db } from '../app/config/database.js';

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

  // Guest only - Pages
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

  // Auth Form Actions (same path as pages - for Inertia form handling)
  app.post('/login', wrapHandler((req, res) => auth.login(req, res)));
  app.post('/register', wrapHandler((req, res) => auth.register(req, res)));
  app.post('/logout', wrapHandler((req, res) => auth.logout(req, res)));
  app.post('/forgot-password', wrapHandler((req, res) => auth.forgotPassword(req, res)));
  app.post('/reset-password', wrapHandler((req, res) => auth.resetPassword(req, res)));

  // Protected - Pages
  app.get('/dashboard', webAuthMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('dashboard');
  });
  app.get('/users', webAuthMiddleware as any, async (req, res: any) => {
    // Fetch users data for the page
    const page = parseInt(req.query?.page as string) || 1;
    const limit = parseInt(req.query?.limit as string) || 10;
    const search = (req.query?.search as string) || '';
    const filter = (req.query?.filter as string) || 'all';
    const offset = (page - 1) * limit;

    // Build query
    let query = db('users').select(
      'id', 'name', 'email', 'phone', 'avatar', 'role',
      'email_verified_at', 'created_at', 'updated_at'
    );

    // Apply search filter
    if (search) {
      query = query.where((builder: any) => {
        builder.where('name', 'like', `%${search}%`)
               .orWhere('email', 'like', `%${search}%`);
      });
    }

    // Apply role filter
    if (filter === 'admin') {
      query = query.where('role', 'admin');
    } else if (filter === 'user') {
      query = query.where('role', 'user');
    } else if (filter === 'verified') {
      query = query.whereNotNull('email_verified_at');
    } else if (filter === 'unverified') {
      query = query.whereNull('email_verified_at');
    }

    // Get total count for pagination
    const countQuery = query.clone();
    const [{ count: totalCount }] = await countQuery.count('* as count');
    const total = Number(totalCount);

    // Apply pagination and ordering
    const usersData = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Transform users to include is_admin and is_verified flags
    const transformedUsers = usersData.map((user: any) => ({
      ...user,
      is_admin: user.role === 'admin',
      is_verified: !!user.email_verified_at
    }));

    const totalPages = Math.ceil(total / limit);

    (res as InertiaResponse).inertia('users', {
      users: transformedUsers,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      search,
      filter,
    });
  });
  app.get('/profile', webAuthMiddleware as any, (req, res: any) => {
    (res as InertiaResponse).inertia('profile');
  });

  // Protected Form Actions (same path pattern - for Inertia form handling)
  app.post('/change-profile', webAuthMiddleware as any, wrapHandler((req, res) => profile.update(req, res)));
  app.post('/change-password', webAuthMiddleware as any, wrapHandler((req, res) => profile.changePassword(req, res)));
  app.post('/users', webAuthMiddleware as any, wrapHandler((req, res) => users.store(req, res)));
  app.put('/users/:id', webAuthMiddleware as any, wrapHandler((req, res) => users.update(req, res)));
  app.delete('/users', webAuthMiddleware as any, wrapHandler((req, res) => users.destroy(req, res)));
  app.post('/assets/avatar', webAuthMiddleware as any, wrapHandler((req, res) => profile.uploadAvatar(req, res)));


  // --- API Routes (for programmatic access) ---

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
  app.get('/public/*', (req, res) => {
    const filePath = req.path.replace('/public/', '');
    res.sendFile(`public/${filePath}`);
  });
  app.get('/storage/*', (req, res) => {
    const filePath = req.path.replace('/storage/', '');
    res.sendFile(`storage/${filePath}`);
  });
}
