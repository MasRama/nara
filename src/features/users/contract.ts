import { z } from 'zod';

export const AVATAR_MAX_FILE_SIZE_MB = 5;
export const AVATAR_MAX_FILE_SIZE_BYTES = AVATAR_MAX_FILE_SIZE_MB * 1024 * 1024;
export const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

/**
 * Users-owned input validation. These schemas are deliberately local
 * copies of the generic person/email shapes: the Users Feature must not
 * depend on reference-only shared modules, so it owns the exact rules it
 * validates (including the user-visible messages its tests assert).
 */
function hasNoControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return false;
  }
  return true;
}

const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100)
  .refine(hasNoControlChars, { message: 'Name must not contain control characters' });

const emailSchema = z
  .string()
  .trim()
  .email('Invalid email format')
  .refine(hasNoControlChars, { message: 'Email must not contain control characters' })
  .transform((value) => value.toLowerCase());

export const profileInputSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
});

export const createUserInputSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  // Passwords are length-bounded only: never trimmed or transformed.
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  roles: z.array(z.string().min(1, 'Role is required')).max(100).optional(),
});

export const updateUserInputSchema = z
  .object({
    name: personNameSchema.optional(),
    email: emailSchema.optional(),
    // Kept in the management contract for backwards-compatible diagnostics;
    // the server rejects non-empty values and directs callers to the explicit
    // reset-password endpoint.
    password: z.string().min(8, 'Password must be at least 8 characters').max(100).optional().or(z.literal('')),
    roles: z.array(z.string().min(1, 'Role is required')).max(100).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.password !== undefined ||
      value.roles !== undefined,
    { message: 'At least one field is required to update', path: ['_root'] },
  );


export const resetUserPasswordInputSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const deleteUsersInputSchema = z.object({
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID must be selected'),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordInputSchema>;
export type DeleteUsersInput = z.infer<typeof deleteUsersInputSchema>;

/**
 * Response schemas, built on demand. Routes type their responses against them
 * and contract tests parse real responses with them; they are strict, so an
 * undeclared field fails. Being a function keeps them out of browser bundles,
 * which only need the inferred types.
 */
export function usersResponseSchemas() {
  const success = <T extends z.ZodType>(data: T) =>
    z.strictObject({ success: z.literal(true), message: z.string(), data });

  const profile = z.strictObject({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    avatar: z.string().nullable(),
  });
  const managedUser = z.strictObject({ ...profile.shape, roles: z.array(z.string()) });
  const asset = z.strictObject({
    id: z.string(),
    name: z.string().nullable(),
    type: z.string(),
    url: z.string(),
    mime_type: z.string().nullable(),
    size: z.number().nullable(),
    storage_key: z.string().nullable(),
    user_id: z.string().nullable(),
    created_at: z.number(),
    updated_at: z.number(),
  });

  return {
    profile,
    managedUser,
    asset,
    error: z.strictObject({
      success: z.literal(false),
      message: z.string(),
      code: z.string(),
      errors: z.record(z.string(), z.array(z.string())).optional(),
    }),
    profileSaved: success(z.strictObject({ user: profile })),
    userSaved: success(z.strictObject({ user: managedUser })),
    users: success(
      z.strictObject({
        users: z.array(managedUser),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
      }),
    ),
    usersDeleted: success(z.strictObject({ deleted: z.number() })),
    avatarUploaded: success(z.strictObject({ asset, url: z.string() })),
  };
}

type UsersResponseSchemas = ReturnType<typeof usersResponseSchemas>;
type Infer<K extends keyof UsersResponseSchemas> = z.infer<UsersResponseSchemas[K]>;

export type UserProfile = Infer<'profile'>;
export type ManagedUser = Infer<'managedUser'>;
export type UserAsset = Infer<'asset'>;
export type UserProfileError = Infer<'error'>;
export type UserProfileSuccess = Infer<'profileSaved'>;
export type ManagedUserResponseSuccess = Infer<'userSaved'>;
export type UsersResponseSuccess = Infer<'users'>;
export type DeleteUsersResponseSuccess = Infer<'usersDeleted'>;
export type AvatarUploadSuccess = Infer<'avatarUploaded'>;

export type UserProfileResponse = UserProfileSuccess | UserProfileError;
export type ManagedUserResponse = ManagedUserResponseSuccess | UserProfileError;
export type UsersResponse = UsersResponseSuccess | UserProfileError;
export type DeleteUsersResponse = DeleteUsersResponseSuccess | UserProfileError;
export type AvatarUploadResponse = AvatarUploadSuccess | UserProfileError;
