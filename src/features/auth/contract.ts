import { z } from 'zod';
import { API_REFUSAL_CODES } from '../../shared/security/codes';
import { CONTROL_MESSAGE, emailSchema, hasNoControlChars, personNameSchema } from '../../shared/security/input';
import type { ActivityDeclaration } from '../../shared/security/activity';
import { permissionRules } from '../../shared/security/access';
import type { PermissionDeclaration } from '../../shared/security/permissions';

/** Live update topic: the signed-in account's profile, roles, or permissions changed; refetch it. */
export const AUTH_ACCOUNT_CHANGED_EVENT = 'auth.account-changed';

/** Live update topic: the signed-in account's list of signed-in devices changed; refetch it. */
export const AUTH_SESSIONS_CHANGED_EVENT = 'auth.sessions-changed';

/** Live update topic: roles, their permissions, or their member counts changed; refetch the list. */
export const AUTH_ROLES_CHANGED_EVENT = 'auth.roles-changed';

/** Live update topic: someone opened or closed a role's edit form; refetch who is editing. */
export const AUTH_ROLES_EDITING_EVENT = 'auth.roles-editing';

/** Refusal code: the update was based on an older revision; the response carries the record as it is now. */
export const STALE_REVISION = 'STALE_REVISION' as const;

/** Refusal codes Auth's routes answer with, besides the ones every API route can. */
export const AUTH_REFUSAL_CODES = [
  'CURRENT_SESSION',
  'DUPLICATE_EMAIL',
  'DUPLICATE_SLUG',
  'INVALID_CREDENTIALS',
  'INVALID_ID',
  'INVALID_PASSWORD',
  'INVALID_TWO_FACTOR_CODE',
  'LOGIN_LOCKED',
  'NOT_FOUND',
  'PROTECTED_ROLE',
  STALE_REVISION,
  'TWO_FACTOR_CHALLENGE_EXPIRED',
  'TWO_FACTOR_DISABLED',
  'TWO_FACTOR_ENABLED',
  'TWO_FACTOR_LOCKED',
  'TWO_FACTOR_SETUP_REQUIRED',
] as const;

/** What Auth reports about sign-in and account security, as `auth.<action>`. */
export const AUTH_ACTIVITY = [
  { action: 'registered', label: 'Account registered', kind: 'create' },
  { action: 'login', label: 'Signed in', kind: 'access' },
  { action: 'logout', label: 'Signed out', kind: 'access' },
  { action: 'password-changed', label: 'Password changed', kind: 'access' },
  { action: 'session-revoked', label: 'Session signed out', kind: 'access' },
  { action: 'sessions-revoked', label: 'Other sessions signed out', kind: 'access' },
  { action: 'two-factor-enabled', label: 'Two-factor turned on', kind: 'access' },
  { action: 'two-factor-disabled', label: 'Two-factor turned off', kind: 'access' },
  { action: 'recovery-codes-regenerated', label: 'Recovery codes regenerated', kind: 'access' },
] as const satisfies readonly ActivityDeclaration[];

/** Auth gates role management itself. */
export const ROLES_PERMISSIONS = [
  { action: 'view', name: 'View Roles' },
  { action: 'create', name: 'Create Roles' },
  { action: 'edit', name: 'Edit Roles' },
  { action: 'delete', name: 'Delete Roles' },
] as const satisfies readonly PermissionDeclaration[];

/** The rule each role-management action requires; routes, pages, and navigation read the same one. */
export const rolesAccess = permissionRules('roles', ROLES_PERMISSIONS);

/** What Auth reports about roles, as `roles.<action>`. */
export const ROLES_ACTIVITY = [
  { action: 'created', label: 'Role created', kind: 'create' },
  { action: 'updated', label: 'Role updated', kind: 'update' },
  { action: 'deleted', label: 'Role deleted', kind: 'delete' },
] as const satisfies readonly ActivityDeclaration[];

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
    /** The revision this edit was based on; a newer one refuses it with `STALE_REVISION`. */
    revision: z.number().int().positive(),
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
    revision: z.number(),
  });
  const permission = z.strictObject({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    resource: z.string(),
    action: z.string(),
    description: z.string().nullable(),
  });
  const editor = z.strictObject({ id: z.string(), name: z.string() });
  const error = z.strictObject({
    success: z.literal(false),
    message: z.string(),
    code: z.enum([...API_REFUSAL_CODES, ...AUTH_REFUSAL_CODES]),
    errors: z.record(z.string(), z.array(z.string())).optional(),
  });

  return {
    publicUser,
    currentUser,
    session,
    twoFactorStatus,
    twoFactorSetup,
    role,
    permission,
    editor,
    error,
    /** 409 for an update based on an older revision. */
    staleRole: z.strictObject({ ...error.shape, code: z.literal(STALE_REVISION), current: role }),
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
    /** Who has each role's edit form open, keyed by role id. */
    rolesEditing: success(z.strictObject({ editing: z.record(z.string(), z.array(editor)) })),
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
export type Editor = Infer<'editor'>;
export type AuthError = Infer<'error'>;
export type StaleRoleError = Infer<'staleRole'>;
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
export type RolesEditingSuccess = Infer<'rolesEditing'>;

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
export type UpdateRoleResponse = RoleResponseSuccess | StaleRoleError | AuthError;
export type RolesEditingResponse = RolesEditingSuccess | AuthError;
export type EditingResponse = AuthSuccess | AuthError;
export type DeleteRolesResponse = DeleteRolesResponseSuccess | AuthError;
