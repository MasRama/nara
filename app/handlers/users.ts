import type { NaraRequest, NaraResponse } from '@core';
import { inertia, jsonSuccess, jsonCreated, jsonError, jsonServerError, jsonValidationError } from '@core';
import { hashPassword } from '@services/Authenticate';
import Logger from '@services/Logger';
import {
  getUsersPaginated, createUser, updateUser, deleteUsers,
  getUserRoles, isAdmin, hasPermission, syncRoles, findUserById
} from '@queries';
import { findAllRoles } from '@queries/roles';
import { randomUUID } from 'crypto';
import { CreateUserSchema, UpdateUserSchema, DeleteUsersSchema, ChangeProfileSchema, zodToErrors } from '@validators';

export const dashboardPage = (req: NaraRequest, res: NaraResponse) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const filter = (req.query.filter as string) || 'all';

  const result = getUsersPaginated(page, limit, search, filter as any);
  const admin = req.user ? isAdmin(req.user.id) : false;

  const users = result.data.map(u => ({
    id: u.id, name: u.name, email: admin ? u.email : undefined,
    phone: u.phone, avatar: u.avatar, is_verified: u.is_verified,
    roles: getUserRoles(u.id).map(r => r.slug),
  }));

  return inertia(res).inertia('dashboard', {
    users, total: result.total, page, limit, search, filter,
  });
};

export const usersPage = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return res.redirect('/login');

  const userId = req.user.id;
  const admin = isAdmin(userId);
  if (!admin && !hasPermission(userId, 'users.view')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const filter = (req.query.filter as string) || 'all';

  const result = getUsersPaginated(page, limit, search, filter as any);
  const canCreate = admin || hasPermission(userId, 'users.create');
  const canEdit = admin || hasPermission(userId, 'users.edit');
  const canDelete = admin || hasPermission(userId, 'users.delete');

  const users = result.data.map(u => ({
    id: u.id, name: u.name,
    email: (admin || canEdit) ? u.email : undefined,
    phone: (admin || canEdit) ? u.phone : undefined,
    avatar: u.avatar, is_verified: u.is_verified,
    roles: getUserRoles(u.id).map(r => r.slug),
  }));

  const roles = findAllRoles().map(r => ({ name: r.name, slug: r.slug, description: r.description }));

  return inertia(res).inertia('users', {
    users, availableRoles: roles,
    permissions: { canCreate, canEdit, canDelete },
    total: result.total, page, limit, search, filter,
  });
};

export const profilePage = (req: NaraRequest, res: NaraResponse) => {
  return inertia(res).inertia('profile');
};

export const changeProfile = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const parsed = ChangeProfileSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const { name, email, phone } = parsed.data;
  updateUser(req.user.id, { name, email, phone: phone || null });
  return jsonSuccess(res, 'Profil berhasil diupdate');
};

export const create = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const { name, email, phone, password, is_verified, roles } = parsed.data;

  try {
    const user = createUser({
      id: randomUUID(),
      name, email, phone: phone || null,
      password: hashPassword(password || email),
      is_verified,
    });

    if (roles?.length) {
      const allRoles = findAllRoles();
      const roleIds = roles.map(slug => allRoles.find(r => r.slug === slug)?.id).filter(Boolean) as string[];
      syncRoles(user.id, roleIds);
    }

    const userRoles = getUserRoles(user.id);
    return jsonCreated(res, 'User created', {
      user: { id: user.id, name: user.name, email: user.email, roles: userRoles.map(r => r.slug) }
    });
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL');
    }
    Logger.error('Failed to create user', error as Error);
    return jsonServerError(res, 'Gagal membuat user');
  }
};

export const update = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const id = req.params.id;
  if (!id) return jsonError(res, 'ID required', 400);

  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.is_verified !== undefined) updateData.is_verified = data.is_verified;
  if (data.password) updateData.password = hashPassword(data.password);

  try {
    const user = updateUser(id, updateData as any);
    if (data.roles !== undefined) {
      const allRoles = findAllRoles();
      const roleIds = data.roles.map(slug => allRoles.find(r => r.slug === slug)?.id).filter(Boolean) as string[];
      syncRoles(id, roleIds);
    }

    const userRoles = getUserRoles(id);
    return jsonSuccess(res, 'User berhasil diupdate', {
      user: { id, name: user?.name, email: user?.email, roles: userRoles.map(r => r.slug) }
    });
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL');
    }
    Logger.error('Failed to update user', error as Error);
    return jsonServerError(res, 'Gagal mengupdate user');
  }
};

export const remove = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const parsed = DeleteUsersSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const { ids } = parsed.data;
  const deleted = deleteUsers(ids);

  Logger.warn('Users deleted', { adminId: req.user.id, deletedIds: ids, count: deleted, ip: req.ip });
  return jsonSuccess(res, 'Users berhasil dihapus', { deleted });
};
