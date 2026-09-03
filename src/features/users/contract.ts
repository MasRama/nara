import { z } from 'zod';
import { emailSchema, personNameSchema } from '../../shared/security/input';

export const profileInputSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
});

export const createUserInputSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  // Passwords are length-bounded only: never trimmed or transformed.
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  roles: z.array(z.string().min(1, 'Role is required')).optional(),
});

export const updateUserInputSchema = z
  .object({
    name: personNameSchema.optional(),
    email: emailSchema.optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(100).optional().or(z.literal('')),
    roles: z.array(z.string().min(1, 'Role is required')).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.password !== undefined ||
      value.roles !== undefined,
    { message: 'At least one field is required to update', path: ['_root'] },
  );

export const deleteUsersInputSchema = z.object({
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID must be selected'),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type DeleteUsersInput = z.infer<typeof deleteUsersInputSchema>;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface ManagedUser extends UserProfile {
  roles: string[];
}

export interface UserProfileSuccess {
  success: true;
  message: string;
  data: { user: UserProfile };
}

export interface ManagedUserResponseSuccess {
  success: true;
  message: string;
  data: { user: ManagedUser };
}

export interface UsersResponseSuccess {
  success: true;
  message: string;
  data: {
    users: ManagedUser[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface DeleteUsersResponseSuccess {
  success: true;
  message: string;
  data: { deleted: number };
}

export interface UserAsset {
  id: string;
  name: string | null;
  type: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  s3_key: string | null;
  user_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface UserProfileError {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, string[]>;
}

export type UserProfileResponse = UserProfileSuccess | UserProfileError;
export type ManagedUserResponse = ManagedUserResponseSuccess | UserProfileError;
export type UsersResponse = UsersResponseSuccess | UserProfileError;
export type DeleteUsersResponse = DeleteUsersResponseSuccess | UserProfileError;
export interface AvatarUploadSuccess {
  success: true;
  message: string;
  data: { asset: UserAsset; url: string };
}

export type AvatarUploadResponse = AvatarUploadSuccess | UserProfileError;
