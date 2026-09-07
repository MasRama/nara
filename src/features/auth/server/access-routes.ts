import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  createRoleInputSchema,
  deleteRolesInputSchema,
  updateRoleInputSchema,
} from '../contract';
import {
  createRoleWithPermissions,
  deleteRoles,
  findAllPermissions,
  findAllRoles,
  findRoleById,
  getRolePermissions,
  getUserCountsForRoles,
  hasPermission,
  isAdmin,
  updateRoleWithPermissions,
} from './access';
import { currentUser as getCurrentUser, SESSION_COOKIE_NAME } from './service';
import { Logger } from '../../../shared/logging';

function validationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    errors[key] ??= [];
    errors[key].push(issue.message);
  }
  return errors;
}

async function requestBody(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return {};
  }
}

function uniqueConstraint(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

function unauthorized(context: Context): Response {
  return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
}

function forbidden(context: Context): Response {
  return context.json({ success: false as const, message: 'Forbidden', code: 'FORBIDDEN' }, 403);
}

function canAccess(context: Context, permission: string): boolean {
  const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  return user !== undefined && (isAdmin(user.id) || hasPermission(user.id, permission));
}

function roleResponse(roleId: string) {
  const role = findRoleById(roleId);
  if (!role) return undefined;
  return {
    ...role,
    permissions: getRolePermissions(role.id).map((permission) => permission.slug),
    userCount: getUserCountsForRoles([role.id]).get(role.id) ?? 0,
  };
}

function resolvePermissionIds(slugs: string[]): { ids: string[]; unknown: string[] } {
  const permissions = findAllPermissions();
  const bySlug = new Map(permissions.map((permission) => [permission.slug, permission.id]));
  const unknown = [...new Set(slugs.filter((slug) => !bySlug.has(slug)))];
  return {
    ids: [...new Set(slugs)].flatMap((slug) => {
      const id = bySlug.get(slug);
      return id ? [id] : [];
    }),
    unknown,
  };
}

function unknownPermissions(context: Context, slugs: string[]): Response {
  return context.json(
    {
      success: false as const,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: { permissions: slugs.map((slug) => `Unknown permission: ${slug}`) },
    },
    422,
  );
}

const listRolesHandler = (context: Context) => {
  const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!user) return unauthorized(context);
  if (!isAdmin(user.id) && !hasPermission(user.id, 'roles.view')) return forbidden(context);

  const roles = findAllRoles();
  const counts = getUserCountsForRoles(roles.map((role) => role.id));
  return context.json({
    success: true as const,
    message: 'OK',
    data: {
      roles: roles.map((role) => ({
        ...role,
        permissions: getRolePermissions(role.id).map((permission) => permission.slug),
        userCount: counts.get(role.id) ?? 0,
      })),
    },
  });
};

const listPermissionsHandler = (context: Context) => {
  const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!user) return unauthorized(context);
  if (!isAdmin(user.id) && !hasPermission(user.id, 'roles.view')) return forbidden(context);

  const grouped: Record<string, ReturnType<typeof findAllPermissions>> = {};
  for (const permission of findAllPermissions()) {
    grouped[permission.resource] ??= [];
    grouped[permission.resource].push(permission);
  }
  return context.json({ success: true as const, message: 'OK', data: grouped });
};

const createRoleHandler = async (context: Context) => {
  const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!user) return unauthorized(context);
  if (!canAccess(context, 'roles.create')) return forbidden(context);

  const parsed = createRoleInputSchema.safeParse(await requestBody(context));
  if (!parsed.success) {
    return context.json(
      {
        success: false as const,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validationErrors(parsed.error),
      },
      422,
    );
  }

  const permissions = resolvePermissionIds(parsed.data.permissions);
  if (permissions.unknown.length > 0) return unknownPermissions(context, permissions.unknown);
  if (permissions.ids.length > 0 && !isAdmin(user.id)) return forbidden(context);

  try {
    const role = createRoleWithPermissions(
      {
        id: randomUUID(),
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
      },
      permissions.ids,
    );
    return context.json({ success: true as const, message: 'Role created', data: { role: roleResponse(role.id)! } }, 201);
  } catch (error) {
    if (uniqueConstraint(error)) {
      return context.json({ success: false as const, message: 'Slug already in use', code: 'DUPLICATE_SLUG' }, 409);
    }
    Logger.error('Failed to create role', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

const updateRoleHandler = async (context: Context) => {
  const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!user) return unauthorized(context);
  if (!canAccess(context, 'roles.edit')) return forbidden(context);

  const roleId = context.req.param('id');
  if (!roleId) return context.json({ success: false as const, message: 'ID required', code: 'INVALID_ID' }, 400);
  const existing = findRoleById(roleId);
  if (!existing) return context.json({ success: false as const, message: 'Role not found', code: 'NOT_FOUND' }, 404);
  if (existing.slug === 'admin') {
    return context.json({ success: false as const, message: 'Cannot edit the admin role', code: 'PROTECTED_ROLE' }, 403);
  }

  const parsed = updateRoleInputSchema.safeParse(await requestBody(context));
  if (!parsed.success) {
    return context.json(
      {
        success: false as const,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validationErrors(parsed.error),
      },
      422,
    );
  }

  const { permissions, ...roleData } = parsed.data;
  const permissionSelection = permissions === undefined ? undefined : resolvePermissionIds(permissions);
  if (permissionSelection && permissionSelection.unknown.length > 0) {
    return unknownPermissions(context, permissionSelection.unknown);
  }
  if (permissionSelection !== undefined && !isAdmin(user.id)) return forbidden(context);

  try {
    const role = updateRoleWithPermissions(roleId, roleData, permissionSelection?.ids);
    if (!role) return context.json({ success: false as const, message: 'Role not found', code: 'NOT_FOUND' }, 404);
    return context.json({ success: true as const, message: 'Role updated', data: { role: roleResponse(roleId)! } });
  } catch (error) {
    if (uniqueConstraint(error)) {
      return context.json({ success: false as const, message: 'Slug already in use', code: 'DUPLICATE_SLUG' }, 409);
    }
    Logger.error('Failed to update role', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

const deleteRolesHandler = async (context: Context) => {
  const user = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!user) return unauthorized(context);
  if (!canAccess(context, 'roles.delete')) return forbidden(context);

  const parsed = deleteRolesInputSchema.safeParse(await requestBody(context));
  if (!parsed.success) {
    return context.json(
      {
        success: false as const,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validationErrors(parsed.error),
      },
      422,
    );
  }
  if (parsed.data.ids.some((roleId) => findRoleById(roleId)?.slug === 'admin')) {
    return context.json({ success: false as const, message: 'Cannot delete the admin role', code: 'PROTECTED_ROLE' }, 400);
  }

  const deleted = deleteRoles(parsed.data.ids);
  Logger.warn('Roles deleted', { adminId: user.id, deletedIds: parsed.data.ids, count: deleted });
  return context.json({ success: true as const, message: 'Roles deleted', data: { deleted } });
};

export const accessRoutes = new Hono()
  .get('/', listRolesHandler)
  .get('/permissions', listPermissionsHandler)
  .post('/', createRoleHandler)
  .put('/:id', updateRoleHandler)
  .delete('/', deleteRolesHandler);
