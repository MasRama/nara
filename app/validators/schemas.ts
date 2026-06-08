import { z } from 'zod';

const phoneRegex = /^[0-9+\-\s()]+$/;

export const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  phone: z.string().regex(phoneRegex, 'Format nomor telepon tidak valid').min(10).max(20).optional().or(z.literal('')),
  password: z.string().min(1, 'Password wajib diisi'),
}).refine(data => data.email || data.phone, {
  message: 'Email atau nomor telepon wajib diisi',
  path: ['_root'],
});

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  email: z.string().email('Format email tidak valid').transform(v => v.toLowerCase()),
  phone: z.string().regex(phoneRegex, 'Format nomor telepon tidak valid').min(10).max(20).optional().nullable().or(z.literal('')),
  password: z.string().min(8, 'Password minimal 8 karakter').max(100, 'Password maksimal 100 karakter'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit').optional().or(z.literal('')),
}).refine(data => data.email || data.phone, {
  message: 'Email atau nomor telepon wajib diisi',
  path: ['_root'],
});

export const ResetPasswordSchema = z.object({
  id: z.string().min(1, 'Token tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(100, 'Password maksimal 100 karakter'),
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Password lama wajib diisi'),
  new_password: z.string().min(8, 'Password minimal 8 karakter').max(100, 'Password maksimal 100 karakter'),
});

export const CreateUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  email: z.string().email('Format email tidak valid').transform(v => v.toLowerCase()),
  phone: z.string().regex(phoneRegex, 'Format nomor telepon tidak valid').min(10).max(20).optional().nullable().or(z.literal('')),
  password: z.string().min(8, 'Password minimal 8 karakter').optional().or(z.literal('')),
  is_verified: z.boolean().optional().default(false),
  roles: z.array(z.string()).optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter').optional(),
  email: z.string().email('Format email tidak valid').transform(v => v.toLowerCase()).optional(),
  phone: z.string().regex(phoneRegex, 'Format nomor telepon tidak valid').min(10).max(20).optional().nullable().or(z.literal('')),
  password: z.string().min(8, 'Password minimal 8 karakter').optional().or(z.literal('')),
  is_verified: z.boolean().optional(),
  roles: z.array(z.string()).optional(),
}).refine(
  data => data.name !== undefined || data.email !== undefined || data.phone !== undefined ||
          data.password !== undefined || data.is_verified !== undefined || data.roles !== undefined,
  { message: 'Minimal satu field harus diisi untuk update', path: ['_root'] }
);

export const DeleteUsersSchema = z.object({
  ids: z.array(z.string().uuid('Format ID tidak valid')).min(1, 'Minimal satu ID harus dipilih'),
});

export const ChangeProfileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  email: z.string().email('Format email tidak valid').transform(v => v.toLowerCase()),
  phone: z.string().regex(phoneRegex, 'Format nomor telepon tidak valid').min(10).max(20).optional().nullable().or(z.literal('')),
});

export const CreateRoleSchema = z.object({
  name: z.string().min(2, 'Nama role minimal 2 karakter').max(100, 'Nama role maksimal 100 karakter'),
  slug: z.string().min(2, 'Slug minimal 2 karakter').max(100, 'Slug maksimal 100 karakter')
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
    .transform(v => v.toLowerCase()),
  description: z.string().max(500, 'Deskripsi maksimal 500 karakter').optional().nullable().or(z.literal('')),
  permissions: z.array(z.string()).optional().default([]),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(2, 'Nama role minimal 2 karakter').max(100, 'Nama role maksimal 100 karakter').optional(),
  slug: z.string().min(2, 'Slug minimal 2 karakter').max(100, 'Slug maksimal 100 karakter')
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
    .transform(v => v.toLowerCase()).optional(),
  description: z.string().max(500, 'Deskripsi maksimal 500 karakter').optional().nullable().or(z.literal('')),
  permissions: z.array(z.string()).optional(),
}).refine(
  data => data.name !== undefined || data.slug !== undefined ||
          data.description !== undefined || data.permissions !== undefined,
  { message: 'Minimal satu field harus diisi untuk update', path: ['_root'] }
);

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type DeleteUsersInput = z.infer<typeof DeleteUsersSchema>;
export type ChangeProfileInput = z.infer<typeof ChangeProfileSchema>;
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
