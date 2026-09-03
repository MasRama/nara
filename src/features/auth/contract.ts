import { z } from 'zod';
import { emailSchema, personNameSchema, roleDescriptionSchema, roleNameSchema, roleSlugSchema } from '../../shared/security/input';

export const registerInputSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  // Passwords are length-bounded only: never trimmed or transformed.
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordInputSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  // Passwords are length-bounded only: never trimmed or transformed.
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface CurrentUser extends PublicUser {
  roles: readonly string[];
  permissions: readonly string[];
}

export interface AuthSuccess<T = undefined> {
  success: true;
  message: string;
  data?: T;
}

export interface AuthError {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, string[]>;
}

export type RegisterResponse = AuthSuccess<{ user: PublicUser }> | AuthError;
export type LoginResponse = AuthSuccess | AuthError;
export type ChangePasswordResponse = AuthSuccess | AuthError;

export const createRoleInputSchema = z.object({
  name: roleNameSchema,
  slug: roleSlugSchema,
  description: roleDescriptionSchema,
  permissions: z.array(z.string().min(1, 'Permission is required')).default([]),
});

export const updateRoleInputSchema = z
  .object({
    name: roleNameSchema.optional(),
    slug: roleSlugSchema.optional(),
    description: roleDescriptionSchema,
    permissions: z.array(z.string().min(1, 'Permission is required')).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.slug !== undefined ||
      value.description !== undefined ||
      value.permissions !== undefined,
    { message: 'At least one field is required to update', path: ['_root'] },
  );
export const deleteRolesInputSchema = z.object({
  ids: z.array(z.string().min(1, 'Role ID is required')).min(1, 'At least one ID must be selected'),
});

export type CreateRoleInput = z.infer<typeof createRoleInputSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleInputSchema>;
export type DeleteRolesInput = z.infer<typeof deleteRolesInputSchema>;

export interface RoleData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: string[];
  userCount: number;
}

export interface PermissionData {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RolesResponseSuccess extends AuthSuccess<{ roles: RoleData[] }> {}
export interface RoleResponseSuccess extends AuthSuccess<{ role: RoleData }> {}
export interface DeleteRolesResponseSuccess extends AuthSuccess<{ deleted: number }> {}
export interface PermissionsResponseSuccess extends AuthSuccess<Record<string, PermissionData[]>> {}
export type RolesResponse = RolesResponseSuccess | AuthError;
export type PermissionsResponse = PermissionsResponseSuccess | AuthError;
export type RoleResponse = RoleResponseSuccess | AuthError;
export type DeleteRolesResponse = DeleteRolesResponseSuccess | AuthError;
export type CurrentUserResponse = AuthSuccess<{ user: CurrentUser }> | AuthError;
