import type { NaraRequest, NaraResponse } from '@core';
import { jsonSuccess, jsonCreated, jsonError, jsonServerError, jsonValidationError, isUniqueConstraintError } from '@core';
import Logger from '@services/Logger';
import {
  findAllRoles, findRoleById, createRole, updateRole, deleteRole,
  getRolePermissions, getPermissionsForRoles, getUserCountsForRoles, syncRolePermissions, findAllPermissions
} from '@queries/roles';
import { isAdmin, hasPermission } from '@queries/users';
import { randomUUID } from 'crypto';
import { CreateRoleSchema, UpdateRoleSchema, zodToErrors } from '@validators';

export const rolesPage = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return res.inertia('roles', { permissions: { canCreate: false, canEdit: false, canDelete: false, canAssign: false } });

  const userId = req.user.id;
  const permissions = {
    canCreate: isAdmin(userId) || hasPermission(userId, 'roles.create'),
    canEdit: isAdmin(userId) || hasPermission(userId, 'roles.edit'),
    canDelete: isAdmin(userId) || hasPermission(userId, 'roles.delete'),
    canAssign: isAdmin(userId) || hasPermission(userId, 'roles.edit'),
  };

  return res.inertia('roles', { permissions });
};

export const listRoles = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'roles.view')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const allRoles = findAllRoles();
  const roleIds = allRoles.map(r => r.id);
  const permsMap = getPermissionsForRoles(roleIds);
  const userCounts = getUserCountsForRoles(roleIds);

  const roles = allRoles.map(role => ({
    ...role,
    permissions: (permsMap.get(role.id) || []).map(p => p.slug),
    user_count: userCounts.get(role.id) || 0,
  }));
  return jsonSuccess(res, 'OK', roles);
};

export const permissionsData = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'roles.view')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const permissions = findAllPermissions();
  const grouped = permissions.reduce((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push({ slug: p.slug, name: p.name, action: p.action, description: p.description });
    return acc;
  }, {} as Record<string, { slug: string; name: string; action: string; description: string | null }[]>);
  return jsonSuccess(res, 'OK', grouped);
};

export const addRole = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'roles.create')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const parsed = CreateRoleSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const { name, slug, description, permissions } = parsed.data;

  try {
    const role = createRole({ id: randomUUID(), name, slug, description });

    if (permissions?.length) {
      const allPerms = findAllPermissions();
      const permIds = permissions.map(s => allPerms.find(p => p.slug === s)?.id).filter(Boolean) as string[];
      syncRolePermissions(role.id, permIds);
    }

    return jsonCreated(res, 'Role berhasil dibuat', {
      role: { ...role, permissions: getRolePermissions(role.id).map(p => p.slug) }
    });
  } catch (error: unknown) {
    Logger.error('Failed to create role', error as Error);
    return jsonServerError(res, 'Gagal membuat role');
  }
};

export const editRole = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'roles.edit')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const id = req.params.id;
  if (!id) return jsonError(res, 'ID required', 400);

  // Non-admins cannot edit the admin role (prevent privilege escalation)
  const existing = findRoleById(id);
  if (!existing) return jsonError(res, 'Role not found', 404);
  if (existing.slug === 'admin' && !isAdmin(req.user.id)) {
    return jsonError(res, 'Tidak dapat mengedit role admin', 403, 'PROTECTED_ROLE');
  }

  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const data = parsed.data;
  const { permissions, ...roleData } = data;

  try {
    const role = updateRole(id, roleData);
    if (!role) return jsonError(res, 'Role not found', 404);

    if (permissions !== undefined) {
      const allPerms = findAllPermissions();
      const permIds = permissions.map(s => allPerms.find(p => p.slug === s)?.id).filter(Boolean) as string[];
      syncRolePermissions(id, permIds);
    }

    return jsonSuccess(res, 'Role berhasil diupdate', {
      role: { ...role, permissions: getRolePermissions(id).map(p => p.slug) }
    });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return jsonError(res, 'Slug sudah digunakan', 400, 'DUPLICATE_SLUG');
    }
    Logger.error('Failed to update role', error as Error);
    return jsonServerError(res, 'Gagal mengupdate role');
  }
};

export const removeRole = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'roles.delete')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const id = req.params.id;
  if (!id) return jsonError(res, 'ID required', 400);

  // Prevent deleting protected roles (admin)
  const existing = findRoleById(id);
  if (!existing) return jsonError(res, 'Role not found', 404);
  if (existing.slug === 'admin') {
    return jsonError(res, 'Tidak dapat menghapus role admin', 400, 'PROTECTED_ROLE');
  }

  const deleted = deleteRole(id);
  if (!deleted) return jsonError(res, 'Role not found', 404);

  return jsonSuccess(res, 'Role berhasil dihapus', { deleted: true });
};
