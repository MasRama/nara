import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  email: z.string().email('Invalid email format').transform(v => v.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password must be at most 100 characters'),
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password must be at most 100 characters'),
});

export const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  email: z.string().email('Invalid email format').transform(v => v.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  roles: z.array(z.string()).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
  email: z.string().email('Invalid email format').transform(v => v.toLowerCase()).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  roles: z.array(z.string()).optional(),
}).refine(
  data => data.name !== undefined || data.email !== undefined ||
          data.password !== undefined || data.roles !== undefined,
  { message: 'At least one field is required to update', path: ['_root'] }
);

export const DeleteUsersSchema = z.object({
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID must be selected'),
});

export const DeleteRolesSchema = z.object({
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID must be selected'),
});

export const ChangeProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  email: z.string().email('Invalid email format').transform(v => v.toLowerCase()),
});

export const CreateRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(100, 'Role name must be at most 100 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').max(100, 'Slug must be at most 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .transform(v => v.toLowerCase()),
  description: z.string().max(500, 'Description must be at most 500 characters').optional().nullable().or(z.literal('')),
  permissions: z.array(z.string()).optional().default([]),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(100, 'Role name must be at most 100 characters').optional(),
  slug: z.string().min(2, 'Slug must be at least 2 characters').max(100, 'Slug must be at most 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
    .transform(v => v.toLowerCase()).optional(),
  description: z.string().max(500, 'Description must be at most 500 characters').optional().nullable().or(z.literal('')),
  permissions: z.array(z.string()).optional(),
}).refine(
  data => data.name !== undefined || data.slug !== undefined ||
          data.description !== undefined || data.permissions !== undefined,
  { message: 'At least one field is required to update', path: ['_root'] }
);

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type DeleteUsersInput = z.infer<typeof DeleteUsersSchema>;
export type DeleteRolesInput = z.infer<typeof DeleteRolesSchema>;
export type ChangeProfileInput = z.infer<typeof ChangeProfileSchema>;
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
