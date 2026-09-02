export { authRoutes } from './server/routes';
export { currentUser as getCurrentUser, hashPassword, SESSION_COOKIE_NAME } from './server/service';
export type { SessionUser } from './server/repository';
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
  CurrentUserResponse,
  DeleteRolesInput,
  LoginInput,
  LoginResponse,
  PermissionData,
  PublicUser,
  RegisterInput,
  RegisterResponse,
  RoleData,
  RolesResponse,
  UpdateRoleInput,
} from './contract';
export {
  createRole,
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
} from './server/access';
export type { Permission, Role, RoleSummary } from './server/access';
export { accessRoutes } from './server/access-routes';
