export { changePasswordInputSchema } from '../contract';
export type { ChangePasswordInput } from '../contract';
export { createAuthClient, type AuthClient } from './client';
export { createAuthSession, useAuthSession } from './session';
export {
  CSRF_BOOTSTRAP_PATH,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfHeaders,
  ensureCsrfToken,
  readCsrfToken,
} from './csrf';
export { createAccessClient, type AccessClient } from './access-client';
export type {
  CurrentUser,
  PermissionData,
  PermissionsResponse,
  RoleData,
  RoleResponse,
  RolesResponse,
} from '../contract';
export { default as LoginPage } from './pages/LoginPage.vue';
export { default as RegisterPage } from './pages/RegisterPage.vue';
export { default as RolesPage } from './pages/RolesPage.vue';
