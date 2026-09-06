import type { Hono } from 'hono';
import {
  createAccount,
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
  SESSION_COOKIE_NAME,
  syncUserRoles,
  updateAccount,
} from '../../features/auth';
import { createAssetRoutes, createUserRoutes, type UsersServerHost } from '../../features/users';
/**
 * Application-owned Users server binding.
 *
 * Users declares typed host requirements; this file supplies them by
 * adapting the Auth Feature, which owns account identity data. The
 * adaptation policy lives here, not in the Feature: Users asks
 * `canManageUsers(actorId, action)` and `findAccountById`/`listAccounts`/
 * `createAccount`/`updateAccount`/`deleteAccounts` while Auth provides
 * `isAdmin`/`hasPermission` and its account directory, so this binding
 * translates between the two vocabularies.
 *
 * Feature evolution never touches this file. Local customization belongs
 * here (for example, swapping the provider or tightening policy).
 */
export const usersServerHost: UsersServerHost = {
  sessionCookieName: SESSION_COOKIE_NAME,

  resolveActor: (sessionToken) => {
    const user = getCurrentUser(sessionToken);
    return user ? { id: user.id, avatar: user.avatar } : undefined;
  },

  hashPassword: (password) => hashPassword(password),

  findAccountById: (userId) => findAccountById(userId),

  listAccounts: (page, limit, search) => listAccounts(page, limit, search),

  createAccount: (input) => createAccount(input),

  updateAccount: (userId, patch) => updateAccount(userId, patch),

  deleteAccounts: (userIds) => deleteAccounts(userIds),

  canManageUsers: (actorId, action) => isAdmin(actorId) || hasPermission(actorId, `users.${action}`),

  canAssignRoles: (actorId) => isAdmin(actorId),

  availableRoles: () => findAllRoles().map((role) => ({ id: role.id, slug: role.slug })),

  rolesForUser: (userId) => getUserRoles(userId).map((role) => role.slug),

  setUserRoles: (userId, roleIds) => {
    syncUserRoles(userId, roleIds);
  },

  usersWithRole: (roleId) => getUsersWithRole(roleId).map((user) => ({ id: user.id })),
};

const userRoutes = createUserRoutes(usersServerHost);
const assetRoutes = createAssetRoutes(usersServerHost);

export default function composeUsersServer(app: Hono): void {
  app.route('/api/users', userRoutes);
  app.route('/api/assets', assetRoutes);
}
