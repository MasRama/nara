import type { Hono } from 'hono';
import { resolve } from 'node:path';
import {
  createAccountWithRoles,
  declarePermissions,
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
  createUsersMaintenance,
  USERS_ACTIVITY,
  USERS_ASSET_ROUTE_POLICIES,
  USERS_PERMISSIONS,
  type UsersServerHost,
} from '../../features/users';
import { declareMaintenance } from '../../shared/database';
import { declareRoutePolicies, type ActivityReporter } from '../../shared/security';
import { createLocalAssetStorage } from '../../shared/storage';

// Auth owns the permission rows; it writes the users.<action> slugs at startup.
declarePermissions('users', USERS_PERMISSIONS);

const assetStorage = createLocalAssetStorage({ root: resolve(process.cwd(), 'storage') });

// Application-owned policy adapter: Users declares the host it needs; Auth
// supplies identity/RBAC. Feature evolution never owns this file.
function createUsersServerHost(recordActivity?: UsersServerHost['recordActivity']): UsersServerHost {
  return {
    sessionCookieName: SESSION_COOKIE_NAME,
    assetStorage,

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
// Users sweeps the assets of accounts deleted before their avatars were.
declareMaintenance('users', createUsersMaintenance(usersServerHost));

/** With `activity`, Users declares what it reports there and reports through it. */
export default function composeUsersServer(app: Hono, options: { activity?: ActivityReporter } = {}): void {
  const host = options.activity
    ? createUsersServerHost(options.activity.declare('users', USERS_ACTIVITY))
    : usersServerHost;
  const userRoutes = createUserRoutes(host);
  const assetRoutes = createAssetRoutes(host);
  app.route('/api/users', userRoutes);
  declareRoutePolicies(app, '/api/assets', USERS_ASSET_ROUTE_POLICIES);
  app.route('/api/assets', assetRoutes);
}
