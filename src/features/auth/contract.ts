import { z } from 'zod';
import { CONTROL_MESSAGE, emailSchema, hasNoControlChars, personNameSchema } from '../../shared/security/input';

/**
 * Auth/RBAC domain validation. Role name/slug/description semantics are owned
 * here, not by feature-neutral security infrastructure: shared code provides
 * only the generic control-byte primitive composed below.
 */
export const roleNameSchema = z
  .string()
  .trim()
  .min(2, 'Role name must be at least 2 characters')
  .max(100, 'Role name must be at most 100 characters')
  .refine(hasNoControlChars, { message: `Role name ${CONTROL_MESSAGE}` });

export const roleSlugSchema = z
  .string()
  .trim()
  .min(2, 'Slug must be at least 2 characters')
  .max(100, 'Slug must be at most 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
  .refine(hasNoControlChars, { message: `Slug ${CONTROL_MESSAGE}` })
  .transform((value) => value.toLowerCase());

export const roleDescriptionSchema = z
  .string()
  .trim()
  .max(500, 'Description must be at most 500 characters')
  .refine(hasNoControlChars, { message: `Description ${CONTROL_MESSAGE}` })
  .nullable()
  .optional();

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

/** Second sign-in step: exactly one of a 6-digit authenticator code or a recovery code. */
export const twoFactorChallengeInputSchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app').optional(),
    recovery_code: z.string().trim().min(1, 'Recovery code is required').max(32).optional(),
  })
  .refine((value) => (value.code === undefined) !== (value.recovery_code === undefined), {
    message: 'Provide an authenticator code or a recovery code',
    path: ['_root'],
  });

export const twoFactorCodeInputSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

/** Sensitive security changes re-confirm the current password. */
export const confirmPasswordInputSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type TwoFactorChallengeInput = z.infer<typeof twoFactorChallengeInputSchema>;
export type TwoFactorCodeInput = z.infer<typeof twoFactorCodeInputSchema>;
export type ConfirmPasswordInput = z.infer<typeof confirmPasswordInputSchema>;

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

/**
 * Response schemas, built on demand. Routes type their responses against them
 * and contract tests parse real responses with them; they are strict, so an
 * undeclared field fails. Being a function keeps them out of browser bundles,
 * which only need the inferred types.
 */
export function authResponseSchemas() {
  const success = <T extends z.ZodType>(data: T) =>
    z.strictObject({ success: z.literal(true), message: z.string(), data });

  const publicUser = z.strictObject({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    avatar: z.string().nullable(),
  });
  const currentUser = z.strictObject({
    ...publicUser.shape,
    roles: z.array(z.string()).readonly(),
    permissions: z.array(z.string()).readonly(),
    mustChangePassword: z.boolean(),
  });
  const session = z.strictObject({
    /** Public session handle; never the cookie token. */
    id: z.string(),
    userAgent: z.string().nullable(),
    ipAddress: z.string().nullable(),
    createdAt: z.number(),
    lastSeenAt: z.number().nullable(),
    current: z.boolean(),
  });
  const twoFactorStatus = z.strictObject({
    enabled: z.boolean(),
    enabledAt: z.number().nullable(),
    recoveryCodesRemaining: z.number(),
  });
  const twoFactorSetup = z.strictObject({ secret: z.string(), otpauthUrl: z.string() });
  const role = z.strictObject({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    permissions: z.array(z.string()),
    userCount: z.number(),
  });
  const permission = z.strictObject({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    resource: z.string(),
    action: z.string(),
    description: z.string().nullable(),
  });

  return {
    publicUser,
    currentUser,
    session,
    twoFactorStatus,
    twoFactorSetup,
    role,
    permission,
    error: z.strictObject({
      success: z.literal(false),
      message: z.string(),
      code: z.string(),
      errors: z.record(z.string(), z.array(z.string())).optional(),
    }),
    /** A success that only carries a message. */
    message: z.strictObject({ success: z.literal(true), message: z.string() }),
    csrfToken: success(z.strictObject({ csrfToken: z.string() })),
    register: success(z.strictObject({ user: publicUser })),
    login: success(z.strictObject({ twoFactorRequired: z.boolean() })),
    me: success(z.strictObject({ user: currentUser })),
    sessions: success(z.strictObject({ sessions: z.array(session) })),
    revokeSessions: success(z.strictObject({ revoked: z.number() })),
    twoFactor: success(z.strictObject({ twoFactor: twoFactorStatus })),
    twoFactorSetupStarted: success(twoFactorSetup),
    recoveryCodes: success(z.strictObject({ recoveryCodes: z.array(z.string()) })),
    roles: success(z.strictObject({ roles: z.array(role) })),
    roleSaved: success(z.strictObject({ role })),
    rolesDeleted: success(z.strictObject({ deleted: z.number() })),
    permissions: success(z.record(z.string(), z.array(permission))),
  };
}

type AuthResponseSchemas = ReturnType<typeof authResponseSchemas>;
type Infer<K extends keyof AuthResponseSchemas> = z.infer<AuthResponseSchemas[K]>;

export type PublicUser = Infer<'publicUser'>;
export type CurrentUser = Infer<'currentUser'>;
export type SessionData = Infer<'session'>;
export type TwoFactorStatus = Infer<'twoFactorStatus'>;
export type TwoFactorSetup = Infer<'twoFactorSetup'>;
export type RoleData = Infer<'role'>;
export type PermissionData = Infer<'permission'>;
export type AuthError = Infer<'error'>;
/** `AuthSuccess` carries only a message; `AuthSuccess<T>` always carries `data`. */
export type AuthSuccess<T = undefined> = [T] extends [undefined]
  ? Infer<'message'>
  : { success: true; message: string; data: T };

export type CsrfTokenSuccess = Infer<'csrfToken'>;
export type RegisterSuccess = Infer<'register'>;
export type LoginSuccess = Infer<'login'>;
export type CurrentUserSuccess = Infer<'me'>;
export type SessionsSuccess = Infer<'sessions'>;
export type RevokeSessionsSuccess = Infer<'revokeSessions'>;
export type TwoFactorStatusSuccess = Infer<'twoFactor'>;
export type TwoFactorSetupSuccess = Infer<'twoFactorSetupStarted'>;
export type RecoveryCodesSuccess = Infer<'recoveryCodes'>;
export type RolesResponseSuccess = Infer<'roles'>;
export type RoleResponseSuccess = Infer<'roleSaved'>;
export type DeleteRolesResponseSuccess = Infer<'rolesDeleted'>;
export type PermissionsResponseSuccess = Infer<'permissions'>;

export type RegisterResponse = RegisterSuccess | AuthError;
export type LoginResponse = LoginSuccess | AuthError;
export type TwoFactorChallengeResponse = AuthSuccess | AuthError;
export type ChangePasswordResponse = AuthSuccess | AuthError;
export type CurrentUserResponse = CurrentUserSuccess | AuthError;
export type SessionsResponse = SessionsSuccess | AuthError;
export type RevokeSessionsResponse = RevokeSessionsSuccess | AuthError;
export type TwoFactorStatusResponse = TwoFactorStatusSuccess | AuthError;
export type TwoFactorSetupResponse = TwoFactorSetupSuccess | AuthError;
export type RecoveryCodesResponse = RecoveryCodesSuccess | AuthError;
export type RolesResponse = RolesResponseSuccess | AuthError;
export type PermissionsResponse = PermissionsResponseSuccess | AuthError;
export type RoleResponse = RoleResponseSuccess | AuthError;
export type DeleteRolesResponse = DeleteRolesResponseSuccess | AuthError;
