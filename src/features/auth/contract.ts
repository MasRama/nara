import { z } from 'zod';

export const registerInputSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format').transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const loginInputSchema = z.object({
  email: z.string().email('Invalid email format').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordInputSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
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
  name: z.string().min(2, 'Role name must be at least 2 characters').max(100, 'Role name must be at most 100 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must be at most 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .transform((value) => value.toLowerCase()),
  description: z.string().max(500, 'Description must be at most 500 characters').nullable().optional(),
  permissions: z.array(z.string().min(1, 'Permission is required')).default([]),
});

export const updateRoleInputSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Role name must be at least 2 characters')
      .max(100, 'Role name must be at most 100 characters')
      .optional(),
    slug: z
      .string()
      .min(2, 'Slug must be at least 2 characters')
      .max(100, 'Slug must be at most 100 characters')
      .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
      .transform((value) => value.toLowerCase())
      .optional(),
    description: z.string().max(500, 'Description must be at most 500 characters').nullable().optional(),
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
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID must be selected'),
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

export interface RolesResponse extends AuthSuccess<{ roles: RoleData[] }> {}
export type CurrentUserResponse = AuthSuccess<{ user: PublicUser }> | AuthError;
