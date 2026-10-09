import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import {
  createUserInputSchema,
  deleteUsersInputSchema,
  profileInputSchema,
  resetUserPasswordInputSchema,
  STALE_REVISION,
  updateUserInputSchema,
  type CreateUserInput,
  type DeleteUsersInput,
  type DeleteUsersResponseSuccess,
  type ManagedUser,
  type ManagedUserResponseSuccess,
  type ProfileInput,
  type ResetUserPasswordInput,
  type UpdateUserInput,
  type UserProfile,
  type UserProfileSuccess,
  type UsersEditingSuccess,
  type UsersMessageSuccess,
  type UsersResponseSuccess,
  USERS_EDITING_EVENT,
} from '../contract';
import { createPresence, publish } from '../../../shared/realtime';
import { createGuard, forbidden, jsonInput, queryInput } from '../../../shared/security';
import { cleanupUserAvatarAssets } from './assets-routes';
import type { UsersServerHost } from './host';
import { announceAccountsChanged } from './live';

const MAX_PAGE = 1_000_000;
const MAX_PAGE_SIZE = 100;

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

function validationFailure(context: Context, field: string, messages: string[]) {
  return context.json(
    { success: false as const, message: 'Validation failed', code: 'VALIDATION_ERROR' as const, errors: { [field]: messages } },
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

/** Paging stays lenient: out-of-range or malformed values are clamped, never refused. */
const listUsersQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

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
  // Who has which account open, for whoever may view the directory.
  const editors = createPresence({
    onChange: () => publish(USERS_EDITING_EVENT, (listener) => host.canManageUsers(listener.userId, 'view')),
  });

  // The account provider is application-chosen; copy only declared fields so
  // provider-specific columns never reach the API.
  function toProfile(user: UserProfile): UserProfile {
    return { id: user.id, name: user.name, email: user.email, avatar: user.avatar, revision: user.revision };
  }

  function withRoles(user: UserProfile): ManagedUser {
    return { ...toProfile(user), roles: host.rolesForUser(user.id) };
  }

  const guard = createGuard((context) => host.resolveActor(getCookie(context, host.sessionCookieName)));
  const canManage = (action: Parameters<UsersServerHost['canManageUsers']>[1]) =>
    guard.allow((actor) => host.canManageUsers(actor.id, action));

  const currentProfileHandler = (context: Context) => {
    const sessionUser = guard.actor(context);

    const user = host.findAccountById(sessionUser.id);
    if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' as const }, 404);
    return context.json({ success: true as const, message: 'OK', data: { user: toProfile(user) } } satisfies UserProfileSuccess);
  };

  const updateProfileHandler = async (context: Context, input: ProfileInput) => {
    const sessionUser = guard.actor(context);

    const { revision, ...profile } = input;
    try {
      const update = host.updateAccount(sessionUser.id, profile, { revision });
      if (update.status === 'missing') {
        return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' as const }, 404);
      }
      if (update.status === 'stale') {
        return context.json(
          {
            success: false as const,
            message: 'Your profile changed elsewhere since you opened it',
            code: STALE_REVISION,
            current: toProfile(update.account),
          },
          409,
        );
      }
      const user = update.account;
      announceAccountsChanged(host, [user.id]);
      host.recordActivity?.({
        action: 'users.profile-updated',
        resource: 'users',
        actorId: sessionUser.id,
        targetId: user.id,
        targetLabel: user.name,
      });
      return context.json({
        success: true as const,
        message: 'Profile updated',
        data: { user: toProfile(user) },
      } satisfies UserProfileSuccess);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' as const }, 409);
      }
      throw error;
    }
  };

  const listUsersHandler = (context: Context, query: z.output<typeof listUsersQuerySchema>) => {
    const page = normalizedQueryInteger(query.page, 1, MAX_PAGE);
    const limit = normalizedQueryInteger(query.limit, 10, MAX_PAGE_SIZE);
    const search = query.search ?? '';
    const result = host.listAccounts(page, limit, search);
    return context.json({
      success: true as const,
      message: 'OK',
      data: {
        users: result.data.map(withRoles),
        total: result.total,
        page,
        limit,
      },
    } satisfies UsersResponseSuccess);
  };

  const createUserHandler = async (context: Context, input: CreateUserInput) => {
    const sessionUser = guard.actor(context);

    const canAssignRoles = host.canAssignRoles(sessionUser.id);
    if (input.roles !== undefined && !canAssignRoles) return forbidden(context);
    const roleSelection = input.roles === undefined ? undefined : resolveRoleIds(host, input.roles);
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
          name: input.name,
          email: input.email,
          passwordHash: await host.hashPassword(input.password),
        },
        roleSelection?.ids,
      );
      announceAccountsChanged(host, [user.id]);
      host.recordActivity?.({
        action: 'users.created',
        resource: 'users',
        actorId: sessionUser.id,
        targetId: user.id,
        targetLabel: user.name,
        metadata: { rolesAssigned: roleSelection?.ids.length ?? 0 },
      });
      return context.json(
        { success: true as const, message: 'User created', data: { user: withRoles(user) } } satisfies ManagedUserResponseSuccess,
        201,
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' as const }, 409);
      }
      throw error;
    }
  };

  // Accounts may edit themselves; anyone else needs users.edit. Checked before
  // the body is validated, so callers without access learn nothing from 422s.
  const canEditTarget: MiddlewareHandler = async (context, next) => {
    const actor = guard.actor(context);
    if (actor.id !== context.req.param('id') && !host.canManageUsers(actor.id, 'edit')) return forbidden(context);
    await next();
  };

  const updateUserHandler = async (context: Context, input: UpdateUserInput) => {
    const sessionUser = guard.actor(context);

    const userId = context.req.param('id');
    if (!userId) return context.json({ success: false as const, message: 'ID required', code: 'INVALID_ID' as const }, 400);
    const self = sessionUser.id === userId;

    const { roles, password, revision, ...profile } = input;
    const actorIsAdmin = host.canAssignRoles(sessionUser.id);

    const target = host.findAccountById(userId);
    if (!target) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' as const }, 404);
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
          { success: false as const, message: 'Cannot remove admin role from yourself', code: 'SELF_DEMOTION' as const },
          400,
        );
      }
    }

    if (password !== undefined && password !== '') {
      return validationFailure(context, 'password', ['Use the dedicated reset-password endpoint for managed credentials']);
    }

    try {
      const update = host.updateAccount(userId, profile, { revision, ...(roleSelection ? { roleIds: roleSelection.ids } : {}) });
      if (update.status === 'missing') {
        return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' as const }, 404);
      }
      if (update.status === 'stale') {
        return context.json(
          {
            success: false as const,
            message: 'Someone else changed this account since you opened it',
            code: STALE_REVISION,
            current: withRoles(update.account),
          },
          409,
        );
      }
      const user = update.account;
      announceAccountsChanged(host, [user.id]);
      host.recordActivity?.({
        action: 'users.updated',
        resource: 'users',
        actorId: sessionUser.id,
        targetId: user.id,
        targetLabel: user.name,
        metadata: {
          self: self,
          rolesChanged: roleSelection !== undefined,
          emailChanged: profile.email !== undefined,
        },
      });
      return context.json({
        success: true as const,
        message: 'User updated',
        data: { user: withRoles(user) },
      } satisfies ManagedUserResponseSuccess);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return context.json({ success: false as const, message: 'Email already in use', code: 'DUPLICATE_EMAIL' as const }, 409);
      }
      throw error;
    }
  };

  const resetPasswordHandler = async (context: Context, input: ResetUserPasswordInput) => {
    const sessionUser = guard.actor(context);

    const userId = context.req.param('id');
    if (!userId) return context.json({ success: false as const, message: 'ID required', code: 'INVALID_ID' as const }, 400);
    if (sessionUser.id === userId) {
      return forbidden(
        context,
        'Use the authenticated password-change flow to change your own password',
        'CURRENT_PASSWORD_REQUIRED',
      );
    }

    const target = host.findAccountById(userId);
    if (!target) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' as const }, 404);
    const actorIsAdmin = host.canAssignRoles(sessionUser.id);
    if (host.rolesForUser(userId).includes('admin') && !actorIsAdmin) {
      return forbidden(context, 'Only administrators may reset an administrator password', 'PROTECTED_ADMIN');
    }

    const user = host.resetPassword(userId, await host.hashPassword(input.password));
    if (!user) return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' as const }, 404);
    host.recordActivity?.({
      action: 'users.password-reset',
      resource: 'users',
      actorId: sessionUser.id,
      targetId: user.id,
      targetLabel: user.name,
    });
    return context.json({
      success: true as const,
      message: 'Password reset',
      data: { user: withRoles(user) },
    } satisfies ManagedUserResponseSuccess);
  };

  const deleteUsersHandler = async (context: Context, input: DeleteUsersInput) => {
    const sessionUser = guard.actor(context);

    if (input.ids.includes(sessionUser.id)) {
      return context.json({ success: false as const, message: 'Cannot delete your own account', code: 'SELF_DELETE' as const }, 400);
    }

    const adminId = adminRoleId(host);
    if (adminId) {
      const remainingAdmins = host.usersWithRole(adminId).filter((user) => !input.ids.includes(user.id));
      if (remainingAdmins.length === 0) {
        return context.json({ success: false as const, message: 'Cannot delete the last admin', code: 'LAST_ADMIN' as const }, 400);
      }
    }

    const targets = input.ids.flatMap((userId) => {
      const user = host.findAccountById(userId);
      return user ? [{ id: user.id, name: user.name }] : [];
    });
    const deleted = host.deleteAccounts(input.ids);
    await cleanupUserAvatarAssets(host, input.ids);
    announceAccountsChanged(host, input.ids);
    for (const target of targets) {
      host.recordActivity?.({
        action: 'users.deleted',
        resource: 'users',
        actorId: sessionUser.id,
        targetId: target.id,
        targetLabel: target.name,
      });
    }
    return context.json({ success: true as const, message: 'Users deleted', data: { deleted } } satisfies DeleteUsersResponseSuccess);
  };

  const listEditingHandler = (context: Context) =>
    context.json({ success: true as const, message: 'OK', data: { editing: editors.editors() } } satisfies UsersEditingSuccess);

  /** Lists the caller as editing the account until the form renews or leaves; unknown accounts answer 404. */
  const startEditingHandler = (context: Context) => {
    const actor = guard.actor(context);
    const userId = context.req.param('id') ?? '';
    if (!host.findAccountById(userId)) {
      return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' as const }, 404);
    }
    const name = host.findAccountById(actor.id)?.name ?? '';
    editors.enter(userId, { id: actor.id, name });
    return context.json({ success: true as const, message: 'OK' } satisfies UsersMessageSuccess);
  };

  const stopEditingHandler = (context: Context) => {
    editors.leave(context.req.param('id') ?? '', guard.actor(context).id);
    return context.json({ success: true as const, message: 'OK' } satisfies UsersMessageSuccess);
  };

  return new Hono()
    .get('/me', guard.signedIn, currentProfileHandler)
    .get('/editing', canManage('view'), listEditingHandler)
    .put('/:id/editing', canManage('edit'), startEditingHandler)
    .delete('/:id/editing', canManage('edit'), stopEditingHandler)
    .patch('/me', guard.signedIn, jsonInput(profileInputSchema), (context) => updateProfileHandler(context, context.req.valid('json')))
    .get('/', canManage('view'), queryInput(listUsersQuerySchema), (context) => listUsersHandler(context, context.req.valid('query')))
    .post('/', canManage('create'), jsonInput(createUserInputSchema), (context) => createUserHandler(context, context.req.valid('json')))
    .put('/:id', guard.signedIn, canEditTarget, jsonInput(updateUserInputSchema), (context) =>
      updateUserHandler(context, context.req.valid('json')),
    )
    .post(
      '/:id/reset-password',
      guard.allow((actor) => host.canResetPasswords(actor.id)),
      jsonInput(resetUserPasswordInputSchema),
      (context) => resetPasswordHandler(context, context.req.valid('json')),
    )
    .delete('/', canManage('delete'), jsonInput(deleteUsersInputSchema), (context) => deleteUsersHandler(context, context.req.valid('json')));
}
