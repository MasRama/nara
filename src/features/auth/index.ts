export { AUTH_ROUTE_POLICIES, authRoutes, createAuthRoutes } from './server/routes';
export {
  createAccountWithRoles,
  deleteAccounts,
  findAccountById,
  isDuplicateEmailError,
  listAccounts,
  resetAccountPassword,
  updateAccountWithRoles,
} from './server/accounts';
export { ensureAdministrator } from './server/administrator';
export type { AdministratorInput, AdministratorResult } from './server/administrator';
export { currentUser as getCurrentUser, hashPassword, liveListener, SESSION_COOKIE_NAME } from './server/service';
export { resetLoginThrottle } from './server/login-throttle';
export { AUTH_MAINTENANCE } from './server/maintenance';
export { cleanupExpiredSessions } from './server/repository';
export {
  ADMIN_ROLE_SLUG,
  AUTH_ACTIVITY,
  ROLES_ACTIVITY,
  changePasswordInputSchema,
  createRoleInputSchema,
  deleteRolesInputSchema,
  loginInputSchema,
  registerInputSchema,
  updateRoleInputSchema,
} from './contract';
export type {
  ChangePasswordInput,
  ChangePasswordResponse,
  CreateRoleInput,
  CurrentUser,
  CurrentUserResponse,
  DeleteRolesInput,
  DeleteRolesResponse,
  LoginInput,
  LoginResponse,
  PermissionData,
  PermissionsResponse,
  PublicUser,
  RegisterInput,
  RegisterResponse,
  RoleData,
  RoleResponse,
  RolesResponse,
  UpdateRoleInput,
} from './contract';
export {
  createRoleWithPermissions,
  findAdministrators,
  findAllPermissions,
  findAllRoles,
  getUserRoles,
  getUsersWithRole,
  hasPermission,
  isAdmin,
  isAllowed,
  syncUserRoles,
} from './server/access';
export { createAccessRoutes } from './server/access-routes';
export { passwordChangeGate, TEMPORARY_PASSWORD_PATHS } from './server/password-change-gate';
export type { AuthActivitySink, RolesActivitySink } from './server/activity';
export { declarePermissions, syncDeclaredPermissions } from './server/permissions';
export type { PermissionSyncResult } from './server/permissions';
