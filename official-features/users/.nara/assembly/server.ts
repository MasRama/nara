import type { Hono } from 'hono';
import { resolve } from 'node:path';
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
import {
  createAssetRoutes,
  createUserRoutes,
  USERS_CHANGED_EVENT,
  USERS_EDITING_EVENT,
  type UsersLiveHost,
  type UsersServerHost,
} from '../../features/users';
import { createPresence, publish } from '../../shared/realtime';
import { createLocalAssetStorage } from '../../shared/storage';

const assetStorage = createLocalAssetStorage({ root: resolve(process.cwd(), 'storage') });

/** Who may read the directory: the rule the list route applies. */
const canViewUsers = (userId: string) => isAdmin(userId) || hasPermission(userId, 'users.view');

const editors = createPresence({
  onChange: () => publish(USERS_EDITING_EVENT, (listener) => canViewUsers(listener.userId)),
});

const usersLive: UsersLiveHost = {
  accountsChanged: (accountIds) => {
    const affected = new Set(accountIds);
    publish(USERS_CHANGED_EVENT, (listener) => affected.has(listener.userId) || canViewUsers(listener.userId));
  },
  startEditing: (accountId, editor) => editors.enter(accountId, editor),
  stopEditing: (accountId, editorId) => editors.leave(accountId, editorId),
  editors: () => editors.editors(),
};

// Application-owned policy adapter: Users declares the host it needs; Auth
// supplies identity/RBAC. Feature evolution never owns this file.
function createUsersServerHost(recordActivity?: UsersServerHost['recordActivity']): UsersServerHost {
  return {
    sessionCookieName: SESSION_COOKIE_NAME,
    assetStorage,
    live: usersLive,

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
