import type { Hono } from 'hono';
import { resolve } from 'node:path';
import {
  ADMIN_ROLE_SLUG,
  createAccountWithRoles,
  declarePermissions,
  deleteAccounts,
  findAccountById,
  findAdministrators,
  findAllRoles,
  getCurrentUser,
  getUserRoles,
  hashPassword,
  isAllowed,
  isDuplicateEmailError,
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
  usersAccess,
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

    // Auth refuses a taken email by throwing; Users expects it as an outcome.
    createAccount: (input, roleIds) => {
      try {
        return { status: 'created', account: createAccountWithRoles(input, roleIds) };
      } catch (error) {
        if (isDuplicateEmailError(error)) return { status: 'duplicate-email' };
        throw error;
      }
    },

    updateAccount: (userId, patch, options) => {
      try {
        return updateAccountWithRoles(userId, patch, options);
      } catch (error) {
        if (isDuplicateEmailError(error)) return { status: 'duplicate-email' };
        throw error;
      }
    },

    resetPassword: (userId, passwordHash) => resetAccountPassword(userId, passwordHash),

    deleteAccounts: (userIds) => deleteAccounts(userIds),

    // Users' rules for the permissions declared above; the browser binding
    // hands its pages the same ones.
    access: usersAccess('users'),

    allows: (actorId, rule) => isAllowed(actorId, rule),

    availableRoles: () =>
      findAllRoles().map((role) => ({ id: role.id, slug: role.slug, administrator: role.slug === ADMIN_ROLE_SLUG })),

    rolesForUser: (userId) => getUserRoles(userId).map((role) => role.slug),

    administrators: () => findAdministrators().map((user) => ({ id: user.id })),
    ...(recordActivity ? { recordActivity } : {}),
  };
}

/** Also what the application's host conformance test runs `describeUsersHost` against. */
export const usersServerHost: UsersServerHost = createUsersServerHost();
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
