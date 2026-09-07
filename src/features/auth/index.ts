export { authRoutes } from './server/routes';
export {
  createAccount,
  createAccountWithRoles,
  deleteAccounts,
  findAccountById,
  listAccounts,
  resetAccountPassword,
  updateAccount,
  updateAccountWithRoles,
} from './server/accounts';
export type { AccountCreateInput, AccountList, AccountManagedUpdateOptions, AccountRecord, AccountUpdateInput } from './server/accounts';
export { currentUser as getCurrentUser, hashPassword, SESSION_COOKIE_NAME } from './server/service';
export { resetLoginThrottle, setThrottleMaxKeysForTests } from './server/login-throttle';
export { cleanupExpiredSessions } from './server/repository';
export {
  changePasswordInputSchema,
  createRoleInputSchema,
  deleteRolesInputSchema,
  loginInputSchema,
  registerInputSchema,
  updateRoleInputSchema,
} from './contract';
export type {
  AuthError,
  AuthSuccess,
  ChangePasswordInput,
  ChangePasswordResponse,
  CreateRoleInput,
  CurrentUser,
  CurrentUserResponse,
  DeleteRolesInput,
  DeleteRolesResponse,
  DeleteRolesResponseSuccess,
  LoginInput,
  LoginResponse,
  PermissionData,
  PermissionsResponse,
  PublicUser,
  RegisterInput,
  RegisterResponse,
  RoleData,
  RoleResponse,
  RoleResponseSuccess,
  RolesResponse,
  UpdateRoleInput,
} from './contract';
export {
  createRole,
  createRoleWithPermissions,
  deleteRoles,
  findAllPermissions,
  findAllRoles,
  findRoleById,
  findRoleBySlug,
  getRolePermissions,
  getUserCountsForRoles,
  getUserPermissions,
  getUserRoles,
  getUsersWithRole,
  hasPermission,
  hasRole,
  isAdmin,
  syncRolePermissions,
  syncUserRoles,
  updateRole,
  updateRoleWithPermissions,
} from './server/access';
export type { Permission, Role, RoleSummary } from './server/access';
export { accessRoutes } from './server/access-routes';
