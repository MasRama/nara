import type { NaraRequest, NaraResponse } from '@core';
import { jsonSuccess, jsonCreated, jsonError, jsonServerError, jsonValidationError, queryInt, queryString, isUniqueConstraintError } from '@core';
import { hashPassword } from '@services/Authenticate';
import Logger from '@services/Logger';
import {
  getUsersPaginated, createUser, updateUser, deleteUsers,
  getUserRoles, getRolesForUsers, isAdmin, hasPermission, syncRoles, findUserById
} from '@queries';
import { findAllRoles, findRoleBySlug, getUsersWithRole } from '@queries/roles';
import { randomUUID } from 'crypto';
import { CreateUserSchema, UpdateUserSchema, DeleteUsersSchema, ChangeProfileSchema, zodToErrors } from '@validators';

export const dashboardPage = (req: NaraRequest, res: NaraResponse) => {
  const page = queryInt(req, 'page');
  const limit = queryInt(req, 'limit', 10);
  const search = queryString(req, 'search');

  const result = getUsersPaginated(page, limit, search);
  const admin = req.user ? isAdmin(req.user.id) : false;
  const rolesMap = getRolesForUsers(result.data.map(u => u.id));

  const users = result.data.map(u => ({
    id: u.id, name: u.name, email: admin ? u.email : undefined,
    avatar: u.avatar,
    roles: (rolesMap.get(u.id) || []).map(r => r.slug),
  }));

  return res.inertia('dashboard', {
    users, total: result.total, page, limit, search,
  });
};

export const usersPage = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return res.redirect('/login');

  const userId = req.user.id;
  const admin = isAdmin(userId);
  if (!admin && !hasPermission(userId, 'users.view')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const page = queryInt(req, 'page');
  const limit = queryInt(req, 'limit', 10);
  const search = queryString(req, 'search');

  const result = getUsersPaginated(page, limit, search);
  const canCreate = admin || hasPermission(userId, 'users.create');
  const canEdit = admin || hasPermission(userId, 'users.edit');
  const canDelete = admin || hasPermission(userId, 'users.delete');
  const rolesMap = getRolesForUsers(result.data.map(u => u.id));

  const users = result.data.map(u => ({
    id: u.id, name: u.name,
    email: (admin || canEdit) ? u.email : undefined,
    avatar: u.avatar,
    roles: (rolesMap.get(u.id) || []).map(r => r.slug),
  }));

  const roles = findAllRoles().map(r => ({ name: r.name, slug: r.slug, description: r.description }));

  return res.inertia('users', {
    users, availableRoles: roles,
    permissions: { canCreate, canEdit, canDelete },
    total: result.total, page, limit, search,
  });
};

export const profilePage = (req: NaraRequest, res: NaraResponse) => {
  return res.inertia('profile');
};

export const changeProfile = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const parsed = ChangeProfileSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const { name, email } = parsed.data;

  try {
    updateUser(req.user.id, { name, email });
    return jsonSuccess(res, 'Profil berhasil diupdate');
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL');
    }
    Logger.error('Failed to update profile', error as Error);
    return jsonServerError(res, 'Gagal mengupdate profil');
  }
};

export const create = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'users.create')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const { name, email, password, roles } = parsed.data;

  // Only admins can assign roles
  const canAssignRoles = isAdmin(req.user.id);

  try {
    const user = createUser({
      id: randomUUID(),
      name, email,
      password: hashPassword(password || email),
    });

    if (roles?.length && canAssignRoles) {
      const allRoles = findAllRoles();
      const roleIds = roles.map(slug => allRoles.find(r => r.slug === slug)?.id).filter(Boolean) as string[];
      syncRoles(user.id, roleIds);
    }

    const userRoles = getUserRoles(user.id);
    return jsonCreated(res, 'User berhasil dibuat', {
      user: { id: user.id, name: user.name, email: user.email, roles: userRoles.map(r => r.slug) }
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
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

  // Users can update own profile, or need users.edit permission
  const isSelf = req.user.id === id;
  const admin = isAdmin(req.user.id);
  if (!isSelf && !admin && !hasPermission(req.user.id, 'users.edit')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const data = parsed.data;
  const { roles, password, ...rest } = data;
  const updateData: Record<string, unknown> = { ...rest };

  if (password) updateData.password = hashPassword(password);

  try {
    const user = updateUser(id, updateData);
    if (roles !== undefined && admin) {
      const allRoles = findAllRoles();
      const roleIds = roles.map(slug => allRoles.find(r => r.slug === slug)?.id).filter(Boolean) as string[];

      // Prevent admin from removing own admin role (self-lockout)
      if (isSelf) {
        const adminRole = allRoles.find(r => r.slug === 'admin');
        if (adminRole && !roleIds.includes(adminRole.id)) {
          return jsonError(res, 'Tidak dapat menghapus role admin dari diri sendiri', 400, 'SELF_DEMOTION');
        }
      }

      syncRoles(id, roleIds);
    }

    const userRoles = getUserRoles(id);
    return jsonSuccess(res, 'User berhasil diupdate', {
      user: { id, name: user?.name, email: user?.email, roles: userRoles.map(r => r.slug) }
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL');
    }
    Logger.error('Failed to update user', error as Error);
    return jsonServerError(res, 'Gagal mengupdate user');
  }
};

export const remove = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'users.delete')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const parsed = DeleteUsersSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const { ids } = parsed.data;

  // Prevent self-deletion
  if (ids.includes(req.user.id)) {
    return jsonError(res, 'Tidak dapat menghapus akun sendiri', 400, 'SELF_DELETE');
  }

  // Prevent deleting the last admin
  const adminRole = findRoleBySlug('admin');
  if (adminRole) {
    const adminUsers = getUsersWithRole(adminRole.id);
    const adminIds = adminUsers.map(u => u.id);
    const remainingAdmins = adminIds.filter(aid => !ids.includes(aid));
    if (remainingAdmins.length === 0) {
      return jsonError(res, 'Tidak dapat menghapus admin terakhir', 400, 'LAST_ADMIN');
    }
  }

  const deleted = deleteUsers(ids);

  Logger.warn('Users deleted', { adminId: req.user.id, deletedIds: ids, count: deleted, ip: req.ip });
  return jsonSuccess(res, 'Users berhasil dihapus', { deleted });
};
