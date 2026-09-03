export { changePasswordInputSchema } from '../contract';
export type { ChangePasswordInput } from '../contract';
export { createAuthClient, type AuthClient } from './client';
export { createAuthSession, useAuthSession } from './session';
export type { AuthSession, AuthStatus } from './session';
export { default as LoginPage } from './pages/LoginPage.vue';
export { default as RegisterPage } from './pages/RegisterPage.vue';
