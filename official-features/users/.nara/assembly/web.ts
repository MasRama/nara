import type { RouteRecordRaw } from 'vue-router';
import { ProfilePage, UsersPage, type UsersWebHost } from '../../features/users/web';
import {
  createAccessClient,
  createAuthClient,
  csrfHeaders,
  ensureCsrfToken,
  useAuthSession,
} from '../../features/auth/web';

/**
 * Application-owned Users web binding.
 *
 * Users pages declare a `UsersWebHost` requirement received as route props;
 * this file supplies the Auth-backed implementation and owns route
 * placement (`/profile`, `/users`). The password-error translation below is
 * deliberate policy adaptation: Auth reports snake_case fields while Users
 * pages render camelCase fields.
 *
 * This file belongs to the application permanently. Feature evolution never
 * touches it.
 */
const authSession = useAuthSession();
const authClient = createAuthClient();
const accessClient = createAccessClient();

function translatePasswordErrors(errors: Record<string, string[]> = {}): Record<string, string[]> {
  const translated: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(errors)) {
    if (key === 'current_password') translated.currentPassword = messages;
    else if (key === 'new_password') translated.newPassword = messages;
    else translated[key] = messages;
  }
  return translated;
}

export const usersWebHost: UsersWebHost = {
  csrf: {
    headers: (extra) => csrfHeaders(extra),
    ensureToken: () => ensureCsrfToken(),
  },

  currentSessionUser: () => {
    const user = authSession.user.value;
    return user ? { id: user.id, name: user.name, email: user.email, avatar: user.avatar } : null;
  },

  can: (permission) => authSession.can(permission),

  isAdmin: () => authSession.hasRole('admin'),

  refreshSession: () => authSession.refresh(),

  syncSessionUser: (user) => {
    authSession.setAuthenticated({ id: user.id, name: user.name, email: user.email, avatar: user.avatar });
  },

  listRoles: async () => {
    const response = await accessClient.listRoles();
    if (!response.success || !response.data) return [];
    return response.data.roles.map((role) => ({ id: role.id, name: role.name, slug: role.slug }));
  },

  changePassword: async (input) => {
    const response = await authClient.changePassword({
      current_password: input.currentPassword,
      new_password: input.newPassword,
    });
    if (response.success) return { success: true as const, message: response.message };
    return { success: false as const, message: response.message, errors: translatePasswordErrors(response.errors) };
  },
};

export default [
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    props: { host: usersWebHost },
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'users',
    component: UsersPage,
    props: { host: usersWebHost },
    meta: { requiresAuth: true, requiresPermission: 'users.view' },
  },
] satisfies RouteRecordRaw[];
