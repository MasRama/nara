import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  createUserInputSchema,
  deleteUsersInputSchema,
  profileInputSchema,
  updateUserInputSchema,
  type ManagedUser,
  type UserProfile,
} from '../contract';
import type { UsersServerHost } from './host';

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

function adminRoleId(host: UsersServerHost): string | undefined {
  return host.availableRoles().find((role) => role.slug === 'admin')?.id;
}

/**
 * Users HTTP behavior constructed from explicit host requirements. The
 * application binding supplies identity and authorization operations;
 * this module never imports another Feature and never touches
 * Auth-owned account rows with SQL.
 */
export function createUserRoutes(host: UsersServerHost) {
  function userWithRoles(user: UserProfile | undefined): ManagedUser | undefined {
    if (!user) return undefined;
    return { ...user, roles: host.rolesForUser(user.id) };
  }

  function currentActor(context: Context) {
    return host.resolveActor(getCookie(context, host.sessionCookieName));
  }

  const currentProfileHandler = (context: Context) => {
    const sessionUser = currentActor(context);
    if (!sessionUser) return unauthorized(context);

    const user = host.findAccountById(sessionUser.id);
    if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
    return context.json({ success: true as const, message: 'OK', data: { user } });
  };

  const updateProfileHandler = async (context: Context) => {
    const sessionUser = currentActor(context);
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
      const user = host.updateAccount(sessionUser.id, parsed.data);
      if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
      return context.json({ success: true as const, message: 'Profile updated', data: { user } });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 400);
      }
      throw error;
    }
  };

  const listUsersHandler = (context: Context) => {
    const sessionUser = currentActor(context);
    if (!sessionUser) return unauthorized(context);
    if (!host.canManageUsers(sessionUser.id, 'view')) return forbidden(context);

    const page = Number.parseInt(context.req.query('page') ?? '1', 10);
    const limit = Number.parseInt(context.req.query('limit') ?? '10', 10);
    const search = context.req.query('search') ?? '';
    const result = host.listAccounts(Number.isNaN(page) ? 1 : page, Number.isNaN(limit) ? 10 : limit, search);
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
    const sessionUser = currentActor(context);
    if (!sessionUser) return unauthorized(context);
    if (!host.canManageUsers(sessionUser.id, 'create')) return forbidden(context);

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
    if (parsed.data.roles !== undefined && !host.canAssignRoles(sessionUser.id)) return forbidden(context);

    try {
      const user = host.createAccount({
        id: randomUUID(),
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: host.hashPassword(parsed.data.password),
      });
      if (host.canAssignRoles(sessionUser.id) && parsed.data.roles) {
        const roleIds = host
          .availableRoles()
          .filter((role) => parsed.data.roles!.includes(role.slug))
          .map((role) => role.id);
        host.setUserRoles(user.id, roleIds);
      }
      return context.json({ success: true as const, message: 'User created', data: { user: userWithRoles(user)! } }, 201);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 400);
      }
      throw error;
    }
  };

  const updateUserHandler = async (context: Context) => {
    const sessionUser = currentActor(context);
    if (!sessionUser) return unauthorized(context);

    const userId = context.req.param('id');
    if (!userId) return context.json({ success: false as const, message: 'ID required', code: 'INVALID_ID' }, 400);
    const self = sessionUser.id === userId;
    if (!self && !host.canManageUsers(sessionUser.id, 'edit')) return forbidden(context);

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
    const sessionCanAssignRoles = host.canAssignRoles(sessionUser.id);
    if (parsed.data.roles !== undefined && !sessionCanAssignRoles) return forbidden(context);

    const { roles, password, ...profile } = parsed.data;
    const roleIds =
      roles !== undefined && sessionCanAssignRoles
        ? host
          .availableRoles()
          .filter((role) => roles.includes(role.slug))
          .map((role) => role.id)
        : undefined;
    if (self && roleIds !== undefined) {
      const adminId = adminRoleId(host);
      if (adminId && !roleIds.includes(adminId)) {
        return context.json(
          { success: false as const, message: 'Cannot remove admin role from yourself', code: 'SELF_DEMOTION' },
          400,
        );
      }
    }

    try {
      const user = host.updateAccount(userId, {
        ...profile,
        ...(password ? { passwordHash: host.hashPassword(password) } : {}),
      });
      if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);

      if (roleIds !== undefined) {
        host.setUserRoles(userId, roleIds);
      }
      return context.json({ success: true as const, message: 'User updated', data: { user: userWithRoles(user)! } });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 400);
      }
      throw error;
    }
  };

  const deleteUsersHandler = async (context: Context) => {
    const sessionUser = currentActor(context);
    if (!sessionUser) return unauthorized(context);
    if (!host.canManageUsers(sessionUser.id, 'delete')) return forbidden(context);

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

    const adminId = adminRoleId(host);
    if (adminId) {
      const remainingAdmins = host.usersWithRole(adminId).filter((user) => !parsed.data.ids.includes(user.id));
      if (remainingAdmins.length === 0) {
        return context.json({ success: false as const, message: 'Cannot delete the last admin', code: 'LAST_ADMIN' }, 400);
      }
    }

    const deleted = host.deleteAccounts(parsed.data.ids);
    return context.json({ success: true as const, message: 'Users deleted', data: { deleted } });
  };

  return new Hono()
    .get('/me', currentProfileHandler)
    .patch('/me', updateProfileHandler)
    .get('/', listUsersHandler)
    .post('/', createUserHandler)
    .put('/:id', updateUserHandler)
    .delete('/', deleteUsersHandler);
}
