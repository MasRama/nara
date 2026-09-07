import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  createUserInputSchema,
  deleteUsersInputSchema,
  profileInputSchema,
  resetUserPasswordInputSchema,
  updateUserInputSchema,
  type ManagedUser,
  type UserProfile,
} from '../contract';
import { cleanupUserAvatarAssets } from './assets-routes';
import type { UsersServerHost } from './host';

const MAX_PAGE = 1_000_000;
const MAX_PAGE_SIZE = 100;

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

function forbidden(context: Context, message = 'Forbidden', code = 'FORBIDDEN'): Response {
  return context.json({ success: false as const, message, code }, 403);
}

function validationFailure(context: Context, field: string, messages: string[]): Response {
  return context.json(
    { success: false as const, message: 'Validation failed', code: 'VALIDATION_ERROR', errors: { [field]: messages } },
    422,
  );
}

function adminRoleId(host: UsersServerHost): string | undefined {
  return host.availableRoles().find((role) => role.slug === 'admin')?.id;
}

function resolveRoleIds(host: UsersServerHost, slugs: string[]): { ids: string[]; unknown: string[] } {
  const roles = host.availableRoles();
  const bySlug = new Map(roles.map((role) => [role.slug, role.id]));
  const uniqueSlugs = [...new Set(slugs)];
  const unknown = uniqueSlugs.filter((slug) => !bySlug.has(slug));
  return {
    ids: uniqueSlugs.flatMap((slug) => {
      const id = bySlug.get(slug);
      return id ? [id] : [];
    }),
    unknown,
  };
}

function normalizedQueryInteger(raw: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(raw ?? String(fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, parsed));
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
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 409);
      }
      throw error;
    }
  };

  const listUsersHandler = (context: Context) => {
    const sessionUser = currentActor(context);
    if (!sessionUser) return unauthorized(context);
    if (!host.canManageUsers(sessionUser.id, 'view')) return forbidden(context);

    const page = normalizedQueryInteger(context.req.query('page'), 1, MAX_PAGE);
    const limit = normalizedQueryInteger(context.req.query('limit'), 10, MAX_PAGE_SIZE);
    const search = context.req.query('search') ?? '';
    const result = host.listAccounts(page, limit, search);
    return context.json({
      success: true as const,
      message: 'OK',
      data: {
        users: result.data.map((user) => userWithRoles(user)!),
        total: result.total,
        page,
        limit,
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

    const canAssignRoles = host.canAssignRoles(sessionUser.id);
    if (parsed.data.roles !== undefined && !canAssignRoles) return forbidden(context);
    const roleSelection = parsed.data.roles === undefined ? undefined : resolveRoleIds(host, parsed.data.roles);
    if (roleSelection && roleSelection.unknown.length > 0) {
      return validationFailure(
        context,
        'roles',
        roleSelection.unknown.map((slug) => `Unknown role: ${slug}`),
      );
    }

    try {
      const user = host.createAccount(
        {
          id: randomUUID(),
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash: await host.hashPassword(parsed.data.password),
        },
        roleSelection?.ids,
      );
      return context.json({ success: true as const, message: 'User created', data: { user: userWithRoles(user)! } }, 201);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 409);
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

    const { roles, password, ...profile } = parsed.data;
    const actorIsAdmin = host.canAssignRoles(sessionUser.id);

    if (!self && !host.canManageUsers(sessionUser.id, 'edit')) return forbidden(context);

    const target = host.findAccountById(userId);
    if (!target) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
    const targetIsAdmin = host.rolesForUser(userId).includes('admin');
    if (!self && targetIsAdmin && !actorIsAdmin) {
      return forbidden(context, 'Only administrators may modify an administrator account', 'PROTECTED_ADMIN');
    }

    // Email is the Auth login identifier. Delegated users.edit may maintain
    // non-sensitive profile data, but cannot take over another account by
    // changing its login identifier.
    if (!self && profile.email !== undefined && !actorIsAdmin) return forbidden(context);
    if (roles !== undefined && !actorIsAdmin) return forbidden(context);

    const roleSelection = roles === undefined ? undefined : resolveRoleIds(host, roles);
    if (roleSelection && roleSelection.unknown.length > 0) {
      return validationFailure(
        context,
        'roles',
        roleSelection.unknown.map((slug) => `Unknown role: ${slug}`),
      );
    }

    if (self && roleSelection !== undefined) {
      const adminId = adminRoleId(host);
      if (adminId && !roleSelection.ids.includes(adminId)) {
        return context.json(
          { success: false as const, message: 'Cannot remove admin role from yourself', code: 'SELF_DEMOTION' },
          400,
        );
      }
    }

    if (password !== undefined && password !== '') {
      return validationFailure(context, 'password', ['Use the dedicated reset-password endpoint for managed credentials']);
    }

    try {
      const user = host.updateAccount(userId, profile, roleSelection ? { roleIds: roleSelection.ids } : undefined);
      if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
      return context.json({ success: true as const, message: 'User updated', data: { user: userWithRoles(user)! } });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' }, 409);
      }
      throw error;
    }
  };

  const resetPasswordHandler = async (context: Context) => {
    const sessionUser = currentActor(context);
    if (!sessionUser) return unauthorized(context);

    const userId = context.req.param('id');
    if (!userId) return context.json({ success: false as const, message: 'ID required', code: 'INVALID_ID' }, 400);
    if (sessionUser.id === userId) {
      return forbidden(
        context,
        'Use the authenticated password-change flow to change your own password',
        'CURRENT_PASSWORD_REQUIRED',
      );
    }
    if (!host.canResetPasswords(sessionUser.id)) return forbidden(context);

    const target = host.findAccountById(userId);
    if (!target) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
    const actorIsAdmin = host.canAssignRoles(sessionUser.id);
    if (host.rolesForUser(userId).includes('admin') && !actorIsAdmin) {
      return forbidden(context, 'Only administrators may reset an administrator password', 'PROTECTED_ADMIN');
    }

    const parsed = resetUserPasswordInputSchema.safeParse(await requestBody(context));
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

    const user = host.resetPassword(userId, await host.hashPassword(parsed.data.password));
    if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
    return context.json({ success: true as const, message: 'Password reset', data: { user: userWithRoles(user)! } });
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
    await cleanupUserAvatarAssets(parsed.data.ids);
    return context.json({ success: true as const, message: 'Users deleted', data: { deleted } });
  };

  return new Hono()
    .get('/me', currentProfileHandler)
    .patch('/me', updateProfileHandler)
    .get('/', listUsersHandler)
    .post('/', createUserHandler)
    .put('/:id', updateUserHandler)
    .post('/:id/reset-password', resetPasswordHandler)
    .delete('/', deleteUsersHandler);
}
