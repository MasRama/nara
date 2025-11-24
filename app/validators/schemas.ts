/**
 * Zod Validation Schemas
 * 
 * Centralized validation schemas for all API endpoints.
 * Using Zod for type-safe runtime validation.
 */
import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const EmailSchema = z
  .string()
  .email('Format email tidak valid')
  .transform(val => val.toLowerCase());

export const PasswordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(100, 'Password maksimal 100 karakter');

export const PhoneSchema = z
  .string()
  .regex(/^[0-9+\-\s()]+$/, 'Format nomor telepon tidak valid')
  .min(10, 'Nomor telepon minimal 10 digit')
  .max(20, 'Nomor telepon maksimal 20 digit')
  .optional()
  .nullable();

export const NameSchema = z
  .string()
  .min(2, 'Nama minimal 2 karakter')
  .max(100, 'Nama maksimal 100 karakter')
  .trim();

export const UUIDSchema = z
  .string()
  .uuid('Format ID tidak valid');

// ============================================
// Auth Schemas
// ============================================

export const LoginSchema = z.object({
  email: EmailSchema.optional(),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit').optional(),
  password: z.string().min(1, 'Password wajib diisi'),
}).refine(
  data => data.email || data.phone,
  { message: 'Email atau nomor telepon wajib diisi' }
);

export const RegisterSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  phone: PhoneSchema,
  password: PasswordSchema,
});

export const ForgotPasswordSchema = z.object({
  email: EmailSchema.optional(),
  phone: z.string().min(10).optional(),
}).refine(
  data => data.email || data.phone,
  { message: 'Email atau nomor telepon wajib diisi' }
);

export const ResetPasswordSchema = z.object({
  id: z.string().min(1, 'Token tidak valid'),
  password: PasswordSchema,
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Password lama wajib diisi'),
  new_password: PasswordSchema,
});

// ============================================
// User Schemas
// ============================================

export const CreateUserSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  phone: PhoneSchema,
  password: z.string().optional(), // Will default to email if not provided
  is_admin: z.boolean().optional().default(false),
  is_verified: z.boolean().optional().default(false),
});

export const UpdateUserSchema = z.object({
  name: NameSchema.optional(),
  email: EmailSchema.optional(),
  phone: PhoneSchema,
  password: PasswordSchema.optional(),
  is_admin: z.boolean().optional(),
  is_verified: z.boolean().optional(),
}).refine(
  data => Object.keys(data).some(key => data[key as keyof typeof data] !== undefined),
  { message: 'Minimal satu field harus diisi untuk update' }
);

export const DeleteUsersSchema = z.object({
  ids: z.array(UUIDSchema).min(1, 'Minimal satu ID harus dipilih'),
});

export const ChangeProfileSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  phone: PhoneSchema,
});

// ============================================
// Pagination Schema
// ============================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional().default(''),
  filter: z.enum(['all', 'verified', 'unverified']).optional().default('all'),
});

// ============================================
// Type Exports
// ============================================

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type DeleteUsersInput = z.infer<typeof DeleteUsersSchema>;
export type ChangeProfileInput = z.infer<typeof ChangeProfileSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
