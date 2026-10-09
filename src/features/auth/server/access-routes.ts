import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  AUTH_ROLES_EDITING_EVENT,
  createRoleInputSchema,
  deleteRolesInputSchema,
  STALE_REVISION,
  updateRoleInputSchema,
  type CreateRoleInput,
  type DeleteRolesInput,
  type DeleteRolesResponseSuccess,
  type PermissionData,
  type AuthSuccess,
  type PermissionsResponseSuccess,
  type RoleData,
  type RolesEditingSuccess,
  type RoleResponseSuccess,
  type RolesResponseSuccess,
  type UpdateRoleInput,
} from '../contract';
import {
  canViewRoles,
  createRoleWithPermissions,
  deleteRoles,
  findAllPermissions,
  findAllRoles,
  findRoleById,
  getRolePermissions,
  getUserCountsForRoles,
  isAdmin,
  updateRoleWithPermissions,
  type Permission,
  type Role,
} from './access';
import { forbidden, jsonInput } from '../../../shared/security';
import { createPresence, publish, type Presence } from '../../../shared/realtime';
import { requirePermission, sessionGuard } from './guard';
import { Logger } from '../../../shared/logging';
import type { RolesActivitySink } from './activity';

function uniqueConstraint(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

// Responses map rows field by field so storage columns never reach the API by accident.
function toRoleData(role: Role, userCount: number): RoleData {
  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    permissions: getRolePermissions(role.id).map((permission) => permission.slug),
    userCount,
    revision: role.revision,
  };
}

function toPermissionData(permission: Permission): PermissionData {
  return {
    id: permission.id,
    name: permission.name,
    slug: permission.slug,
    resource: permission.resource,
    action: permission.action,
    description: permission.description,
  };
}

function countedRoleData(role: Role): RoleData {
  return toRoleData(role, getUserCountsForRoles([role.id]).get(role.id) ?? 0);
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

function unknownPermissions(context: Context, slugs: string[]) {
  return context.json(
    {
      success: false as const,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR' as const,
      errors: { permissions: slugs.map((slug) => `Unknown permission: ${slug}`) },
    },
    422,
  );
}

const listRolesHandler = (context: Context) => {
  const roles = findAllRoles();
  const counts = getUserCountsForRoles(roles.map((role) => role.id));
  return context.json({
    success: true as const,
    message: 'OK',
    data: {
      roles: roles.map((role) => toRoleData(role, counts.get(role.id) ?? 0)),
    },
  } satisfies RolesResponseSuccess);
};

const listPermissionsHandler = (context: Context) => {
  const grouped: Record<string, PermissionData[]> = {};
  for (const permission of findAllPermissions()) {
    grouped[permission.resource] ??= [];
    grouped[permission.resource].push(toPermissionData(permission));
  }
  return context.json({ success: true as const, message: 'OK', data: grouped } satisfies PermissionsResponseSuccess);
};

const createRoleHandler = async (context: Context, input: CreateRoleInput, activity?: RolesActivitySink) => {
  const user = sessionGuard.actor(context);

  const permissions = resolvePermissionIds(input.permissions);
  if (permissions.unknown.length > 0) return unknownPermissions(context, permissions.unknown);
  if (permissions.ids.length > 0 && !isAdmin(user.id)) return forbidden(context);

  try {
    const role = createRoleWithPermissions(
      {
        id: randomUUID(),
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
      },
      permissions.ids,
    );
    activity?.({
      action: 'roles.created',
      resource: 'roles',
      actorId: user.id,
      targetId: role.id,
      targetLabel: role.name,
      metadata: { permissionCount: permissions.ids.length },
    });
    return context.json(
      { success: true as const, message: 'Role created', data: { role: toRoleData(role, 0) } } satisfies RoleResponseSuccess,
      201,
    );
  } catch (error) {
    if (uniqueConstraint(error)) {
      return context.json({ success: false as const, message: 'Slug already in use', code: 'DUPLICATE_SLUG' as const }, 409);
    }
    Logger.error('Failed to create role', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

const updateRoleHandler = async (context: Context, input: UpdateRoleInput, activity?: RolesActivitySink) => {
  const user = sessionGuard.actor(context);

  const roleId = context.req.param('id');
  if (!roleId) return context.json({ success: false as const, message: 'ID required', code: 'INVALID_ID' as const }, 400);
  const existing = findRoleById(roleId);
  if (!existing) return context.json({ success: false as const, message: 'Role not found', code: 'NOT_FOUND' as const }, 404);
  if (existing.slug === 'admin') {
    return context.json({ success: false as const, message: 'Cannot edit the admin role', code: 'PROTECTED_ROLE' as const }, 403);
  }

  const { permissions, revision, ...roleData } = input;
  const permissionSelection = permissions === undefined ? undefined : resolvePermissionIds(permissions);
  if (permissionSelection && permissionSelection.unknown.length > 0) {
    return unknownPermissions(context, permissionSelection.unknown);
  }
  if (permissionSelection !== undefined && !isAdmin(user.id)) return forbidden(context);

  try {
    const update = updateRoleWithPermissions(roleId, roleData, permissionSelection?.ids, revision);
    if (update.status === 'missing') {
      return context.json({ success: false as const, message: 'Role not found', code: 'NOT_FOUND' as const }, 404);
    }
    if (update.status === 'stale') {
      return context.json(
        {
          success: false as const,
          message: 'Someone else changed this role since you opened it',
          code: STALE_REVISION,
          current: countedRoleData(update.role),
        },
        409,
      );
    }
    const { role } = update;
    activity?.({
      action: 'roles.updated',
      resource: 'roles',
      actorId: user.id,
      targetId: role.id,
      targetLabel: role.name,
      metadata: {
        permissionsChanged: permissionSelection !== undefined,
      },
    });
    return context.json({
      success: true as const,
      message: 'Role updated',
      data: { role: countedRoleData(role) },
    } satisfies RoleResponseSuccess);
  } catch (error) {
    if (uniqueConstraint(error)) {
      return context.json({ success: false as const, message: 'Slug already in use', code: 'DUPLICATE_SLUG' as const }, 409);
    }
    Logger.error('Failed to update role', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

const deleteRolesHandler = async (context: Context, input: DeleteRolesInput, activity?: RolesActivitySink) => {
  const user = sessionGuard.actor(context);

  if (input.ids.some((roleId) => findRoleById(roleId)?.slug === 'admin')) {
    return context.json({ success: false as const, message: 'Cannot delete the admin role', code: 'PROTECTED_ROLE' as const }, 400);
  }

  const targets = input.ids.flatMap((roleId) => {
    const role = findRoleById(roleId);
    return role ? [{ id: role.id, name: role.name }] : [];
  });
  const deleted = deleteRoles(input.ids);
  Logger.warn('Roles deleted', { adminId: user.id, deletedIds: input.ids, count: deleted });
  for (const target of targets) {
    activity?.({
      action: 'roles.deleted',
      resource: 'roles',
      actorId: user.id,
      targetId: target.id,
      targetLabel: target.name,
    });
  }
  return context.json({ success: true as const, message: 'Roles deleted', data: { deleted } } satisfies DeleteRolesResponseSuccess);
};

const listEditingHandler = (context: Context, editors: Presence) =>
  context.json({ success: true as const, message: 'OK', data: { editing: editors.editors() } } satisfies RolesEditingSuccess);

/** Lists the caller as editing the role until the form renews or leaves; unknown roles answer 404. */
const enterEditingHandler = (context: Context, editors: Presence) => {
  const { user } = sessionGuard.actor(context);
  const roleId = context.req.param('id') ?? '';
  if (!findRoleById(roleId)) return context.json({ success: false as const, message: 'Role not found', code: 'NOT_FOUND' as const }, 404);
  editors.enter(roleId, { id: user.id, name: user.name });
  return context.json({ success: true as const, message: 'OK' } satisfies AuthSuccess);
};

const leaveEditingHandler = (context: Context, editors: Presence) => {
  editors.leave(context.req.param('id') ?? '', sessionGuard.actor(context).id);
  return context.json({ success: true as const, message: 'OK' } satisfies AuthSuccess);
};

export function createAccessRoutes(activity?: RolesActivitySink) {
  const editors = createPresence({
    onChange: () => publish(AUTH_ROLES_EDITING_EVENT, (listener) => canViewRoles(listener.userId)),
  });

  return new Hono()
    .get('/', requirePermission('roles.view'), listRolesHandler)
    .get('/permissions', requirePermission('roles.view'), listPermissionsHandler)
    .get('/editing', requirePermission('roles.view'), (context) => listEditingHandler(context, editors))
    .put('/:id/editing', requirePermission('roles.edit'), (context) => enterEditingHandler(context, editors))
    .delete('/:id/editing', requirePermission('roles.edit'), (context) => leaveEditingHandler(context, editors))
    .post('/', requirePermission('roles.create'), jsonInput(createRoleInputSchema), (context) =>
      createRoleHandler(context, context.req.valid('json'), activity),
    )
    .put('/:id', requirePermission('roles.edit'), jsonInput(updateRoleInputSchema), (context) =>
      updateRoleHandler(context, context.req.valid('json'), activity),
    )
    .delete('/', requirePermission('roles.delete'), jsonInput(deleteRolesInputSchema), (context) =>
      deleteRolesHandler(context, context.req.valid('json'), activity),
    );
}
