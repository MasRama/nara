import type { NaraRequest, NaraResponse } from '@core';
import { inertia, jsonSuccess, jsonCreated, jsonError, jsonServerError, jsonValidationError } from '@core';
import Logger from '@services/Logger';
import SQLite from '@services/SQLite';
import {
  findAllRoles, findRoleById, createRole, updateRole, deleteRole,
  getRolePermissions, syncRolePermissions, findAllPermissions
} from '@queries/roles';
import { isAdmin, hasPermission } from '@queries/users';
import { randomUUID } from 'crypto';
import { CreateRoleSchema, UpdateRoleSchema, zodToErrors } from '@validators';

export const rolesPage = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return inertia(res).inertia('roles', { permissions: { canCreate: false, canEdit: false, canDelete: false, canAssign: false } });

  const userId = req.user.id;
  const permissions = {
    canCreate: isAdmin(userId) || hasPermission(userId, 'roles.create'),
    canEdit: isAdmin(userId) || hasPermission(userId, 'roles.edit'),
    canDelete: isAdmin(userId) || hasPermission(userId, 'roles.delete'),
    canAssign: isAdmin(userId) || hasPermission(userId, 'roles.edit'),
  };

  return inertia(res).inertia('roles', { permissions });
};

export const index = (req: NaraRequest, res: NaraResponse) => {
  const roles = findAllRoles().map(role => {
    const userCount = SQLite.one<{ count: number }>`SELECT COUNT(*) as count FROM user_roles WHERE role_id = ${role.id}`;
    return {
      ...role,
      permissions: getRolePermissions(role.id).map(p => p.slug),
      user_count: userCount?.count || 0,
    };
  });
  return jsonSuccess(res, 'OK', roles);
};

export const permissionsData = (req: NaraRequest, res: NaraResponse) => {
  const permissions = findAllPermissions();
  const grouped = permissions.reduce((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push({ slug: p.slug, name: p.name, action: p.action, description: p.description });
    return acc;
  }, {} as Record<string, { slug: string; name: string; action: string; description: string | null }[]>);
  return jsonSuccess(res, 'OK', grouped);
};

export const store = (req: NaraRequest, res: NaraResponse) => {
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

export const update = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'roles.edit')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const id = req.params.id;
  if (!id) return jsonError(res, 'ID required', 400);

  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  const data = parsed.data;

  try {
    const roleData: Record<string, unknown> = {};
    if (data.name !== undefined) roleData.name = data.name;
    if (data.slug !== undefined) roleData.slug = data.slug;
    if (data.description !== undefined) roleData.description = data.description;

    const role = updateRole(id, roleData as any);
    if (!role) return jsonError(res, 'Role not found', 404);

    if (data.permissions !== undefined) {
      const allPerms = findAllPermissions();
      const permIds = data.permissions.map(s => allPerms.find(p => p.slug === s)?.id).filter(Boolean) as string[];
      syncRolePermissions(id, permIds);
    }

    return jsonSuccess(res, 'Role berhasil diupdate', {
      role: { ...role, permissions: getRolePermissions(id).map(p => p.slug) }
    });
  } catch (error: unknown) {
    Logger.error('Failed to update role', error as Error);
    return jsonServerError(res, 'Gagal mengupdate role');
  }
};

export const destroy = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  if (!isAdmin(req.user.id) && !hasPermission(req.user.id, 'roles.delete')) {
    return jsonError(res, 'Forbidden', 403);
  }

  const id = req.params.id;
  if (!id) return jsonError(res, 'ID required', 400);

  const deleted = deleteRole(id);
  if (!deleted) return jsonError(res, 'Role not found', 404);

  return jsonSuccess(res, 'Role berhasil dihapus', { deleted: true });
};
