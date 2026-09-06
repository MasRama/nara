import type { Hono } from 'hono';
import {
  findAllRoles,
  getCurrentUser,
  getUserRoles,
  getUsersWithRole,
  hashPassword,
  hasPermission,
  isAdmin,
  SESSION_COOKIE_NAME,
  syncUserRoles,
} from '../../features/auth';
import { createAssetRoutes, createUserRoutes, type UsersServerHost } from '../../features/users';

/**
 * Application-owned Users server binding.
 *
 * Users declares typed host requirements; this file supplies them by
 * adapting the Auth Feature. The adaptation policy lives here, not in the
 * Feature: Users asks `canManageUsers(actorId, action)` and
 * `canAssignRoles(actorId)` while Auth provides `isAdmin`/`hasPermission`,
 * so this binding translates between the two vocabularies.
 *
 * This file belongs to the application permanently. Feature evolution never
 * touches it: local customization (swapping the provider, tightening
 * policy) belongs here.
 */
export const usersServerHost: UsersServerHost = {
  sessionCookieName: SESSION_COOKIE_NAME,

  resolveActor: (sessionToken) => {
    const user = getCurrentUser(sessionToken);
    return user ? { id: user.id, avatar: user.avatar } : undefined;
  },

  hashPassword: (password) => hashPassword(password),

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
