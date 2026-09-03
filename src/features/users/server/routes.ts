import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  findAllRoles,
  findRoleBySlug,
  getUserRoles,
  getUsersWithRole,
  hasPermission,
  isAdmin,
  syncUserRoles,
} from '../../auth';
import { getCurrentUser, hashPassword, SESSION_COOKIE_NAME } from '../../auth';
import {
  createUserInputSchema,
  deleteUsersInputSchema,
  profileInputSchema,
  updateUserInputSchema,
  type ManagedUser,
  type UserProfile,
} from '../contract';
import { Logger } from '../../../shared/logging';
import {
  createManagedUser,
  deleteUsers,
  findUserProfileById,
  listUsers,
  updateManagedUser,
  updateUserProfile,
} from './repository';

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

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

function unauthorized(context: Context): Response {
  return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
}

function forbidden(context: Context): Response {
  return context.json({ success: false as const, message: 'Forbidden', code: 'FORBIDDEN' }, 403);
}

function userWithRoles(user: UserProfile | undefined): ManagedUser | undefined {
  if (!user) return undefined;
  return { ...user, roles: getUserRoles(user.id).map((role) => role.slug) };
}
function canManage(userId: string, permission: string): boolean {
  return isAdmin(userId) || hasPermission(userId, permission);
}

const currentProfileHandler = (context: Context) => {
  const sessionUser = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!sessionUser) return unauthorized(context);

  const user = findUserProfileById(sessionUser.id);
  if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
  return context.json({ success: true as const, message: 'OK', data: { user } });
};

const updateProfileHandler = async (context: Context) => {
  const sessionUser = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!sessionUser) return unauthorized(context);

  const parsed = profileInputSchema.safeParse(await requestBody(context));
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

  try {
    const user = updateUserProfile(sessionUser.id, parsed.data);
    if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
    Logger.logAuth('profile_updated', { userId: user.id });
    return context.json({ success: true as const, message: 'Profile updated', data: { user } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 400);
    }
    throw error;
  }
};

const listUsersHandler = (context: Context) => {
  const sessionUser = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!sessionUser) return unauthorized(context);
  if (!canManage(sessionUser.id, 'users.view')) return forbidden(context);

  const page = Number.parseInt(context.req.query('page') ?? '1', 10);
  const limit = Number.parseInt(context.req.query('limit') ?? '10', 10);
  const search = context.req.query('search') ?? '';
  const result = listUsers(Number.isNaN(page) ? 1 : page, Number.isNaN(limit) ? 10 : limit, search);
  return context.json({
    success: true as const,
    message: 'OK',
    data: {
      users: result.data.map((user) => userWithRoles(user)!),
      total: result.total,
      page: Math.max(1, Number.isNaN(page) ? 1 : page),
      limit: Math.max(1, Number.isNaN(limit) ? 10 : limit),
    },
  });
};

const createUserHandler = async (context: Context) => {
  const sessionUser = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!sessionUser) return unauthorized(context);
  if (!canManage(sessionUser.id, 'users.create')) return forbidden(context);

  const parsed = createUserInputSchema.safeParse(await requestBody(context));
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
  if (parsed.data.roles !== undefined && !isAdmin(sessionUser.id)) return forbidden(context);

  try {
    const user = createManagedUser({
      id: randomUUID(),
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashPassword(parsed.data.password || parsed.data.email),
    });
    if (isAdmin(sessionUser.id) && parsed.data.roles) {
      const roleIds = findAllRoles()
        .filter((role) => parsed.data.roles!.includes(role.slug))
        .map((role) => role.id);
      syncUserRoles(user.id, roleIds);
    }
    return context.json({ success: true as const, message: 'User created', data: { user: userWithRoles(user)! } }, 201);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 400);
    }
    Logger.error('Failed to create user', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

const updateUserHandler = async (context: Context) => {
  const sessionUser = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!sessionUser) return unauthorized(context);

  const userId = context.req.param('id');
  if (!userId) return context.json({ success: false as const, message: 'ID required', code: 'INVALID_ID' }, 400);
  const self = sessionUser.id === userId;
  if (!self && !canManage(sessionUser.id, 'users.edit')) return forbidden(context);

  const parsed = updateUserInputSchema.safeParse(await requestBody(context));
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
  if (parsed.data.roles !== undefined && !isAdmin(sessionUser.id)) return forbidden(context);

  const { roles, password, ...profile } = parsed.data;
  try {
    const user = updateManagedUser(userId, {
      ...profile,
      ...(password ? { password: hashPassword(password) } : {}),
    });
    if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);

    if (roles !== undefined && isAdmin(sessionUser.id)) {
      const roleIds = findAllRoles()
        .filter((role) => roles.includes(role.slug))
        .map((role) => role.id);
      if (self) {
        const adminRole = findRoleBySlug('admin');
        if (adminRole && !roleIds.includes(adminRole.id)) {
          return context.json(
            { success: false as const, message: 'Cannot remove admin role from yourself', code: 'SELF_DEMOTION' },
            400,
          );
        }
      }
      syncUserRoles(userId, roleIds);
    }
    return context.json({ success: true as const, message: 'User updated', data: { user: userWithRoles(user)! } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 400);
    }
    Logger.error('Failed to update user', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

const deleteUsersHandler = async (context: Context) => {
  const sessionUser = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!sessionUser) return unauthorized(context);
  if (!canManage(sessionUser.id, 'users.delete')) return forbidden(context);

  const parsed = deleteUsersInputSchema.safeParse(await requestBody(context));
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
  if (parsed.data.ids.includes(sessionUser.id)) {
    return context.json({ success: false as const, message: 'Cannot delete your own account', code: 'SELF_DELETE' }, 400);
  }

  const adminRole = findRoleBySlug('admin');
  if (adminRole) {
    const remainingAdmins = getUsersWithRole(adminRole.id).filter((user) => !parsed.data.ids.includes(user.id));
    if (remainingAdmins.length === 0) {
      return context.json({ success: false as const, message: 'Cannot delete the last admin', code: 'LAST_ADMIN' }, 400);
    }
  }

  const deleted = deleteUsers(parsed.data.ids);
  Logger.warn('Users deleted', { adminId: sessionUser.id, deletedIds: parsed.data.ids, count: deleted });
  return context.json({ success: true as const, message: 'Users deleted', data: { deleted } });
};

export const userRoutes = new Hono()
  .get('/me', currentProfileHandler)
  .patch('/me', updateProfileHandler)
  .get('/', listUsersHandler)
  .post('/', createUserHandler)
  .put('/:id', updateUserHandler)
  .delete('/', deleteUsersHandler);
