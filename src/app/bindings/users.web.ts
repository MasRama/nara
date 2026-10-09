import type { RouteRecordRaw } from 'vue-router';
import { ProfilePage, UsersPage, type UsersWebHost } from '../../features/users/web';
import {
  createAccessClient,
  createAuthClient,
  csrfHeaders,
  ensureCsrfToken,
  useAuthSession,
} from '../../features/auth/web';
import { onServerEvent } from '../../shared/realtime/browser';

// Application-owned Auth adapter and route placement for Users.
const authSession = useAuthSession();
const authClient = createAuthClient();
const accessClient = createAccessClient();

function translatePasswordErrors(errors: Record<string, string[]> = {}): Record<string, string[]> {
  // Auth owns snake_case API fields; Users renders camelCase form fields.
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
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Unable to load roles');
    }
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

  onLiveEvent: (topic, handler) => onServerEvent(topic, handler),
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
