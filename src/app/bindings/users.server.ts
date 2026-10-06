import type { Hono } from 'hono';
import {
  createAccountWithRoles,
  deleteAccounts,
  findAccountById,
  findAllRoles,
  getCurrentUser,
  getUserRoles,
  getUsersWithRole,
  hashPassword,
  hasPermission,
  isAdmin,
  listAccounts,
  resetAccountPassword,
  SESSION_COOKIE_NAME,
  updateAccountWithRoles,
} from '../../features/auth';
import { createAssetRoutes, createUserRoutes, type UsersServerHost } from '../../features/users';

// Application-owned policy adapter: Users declares the host it needs; Auth
// supplies identity/RBAC. Feature evolution never owns this file.
function createUsersServerHost(recordActivity?: UsersServerHost['recordActivity']): UsersServerHost {
  return {
    sessionCookieName: SESSION_COOKIE_NAME,

    resolveActor: (sessionToken) => {
      const user = getCurrentUser(sessionToken);
      return user ? { id: user.id, avatar: user.avatar } : undefined;
    },

    hashPassword: (password) => hashPassword(password),

    findAccountById: (userId) => findAccountById(userId),

    listAccounts: (page, limit, search) => listAccounts(page, limit, search),

    createAccount: (input, roleIds) => createAccountWithRoles(input, roleIds),

    updateAccount: (userId, patch, options) => updateAccountWithRoles(userId, patch, options),

    resetPassword: (userId, passwordHash) => resetAccountPassword(userId, passwordHash),

    deleteAccounts: (userIds) => deleteAccounts(userIds),

    canManageUsers: (actorId, action) => isAdmin(actorId) || hasPermission(actorId, `users.${action}`),

    canAssignRoles: (actorId) => isAdmin(actorId),

    canResetPasswords: (actorId) => isAdmin(actorId) || hasPermission(actorId, 'users.reset-password'),

    availableRoles: () => findAllRoles().map((role) => ({ id: role.id, slug: role.slug })),

    rolesForUser: (userId) => getUserRoles(userId).map((role) => role.slug),

    usersWithRole: (roleId) => getUsersWithRole(roleId).map((user) => ({ id: user.id })),
    ...(recordActivity ? { recordActivity } : {}),
  };
}

const usersServerHost: UsersServerHost = createUsersServerHost();

export default function composeUsersServer(
  app: Hono,
  options: { recordActivity?: UsersServerHost['recordActivity'] } = {},
): void {
  const host = options.recordActivity ? createUsersServerHost(options.recordActivity) : usersServerHost;
  const userRoutes = createUserRoutes(host);
  const assetRoutes = createAssetRoutes(host);
  app.route('/api/users', userRoutes);
  app.route('/api/assets', assetRoutes);
}
