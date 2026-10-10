// Browser capabilities Users needs but does not own. The application binds
// these to its identity provider; Users web never imports Auth directly.
import type { UsersAccess } from '../contract';
import type { AccessRule } from '../../../shared/security/access';

export interface UsersWebRole {
  id: string;
  name: string;
  slug: string;
}

export interface UsersWebSessionUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface UsersWebCsrf {
  headers(extra?: HeadersInit): Record<string, string>;
  ensureToken(): Promise<unknown>;
}

export interface UsersPasswordChange {
  currentPassword: string;
  newPassword: string;
}

export interface UsersPasswordChangeResult {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

export interface UsersWebHost {
  readonly csrf: UsersWebCsrf;
  currentSessionUser(): UsersWebSessionUser | null;
  /** The rules the server host enforces, checked for the signed-in user; the server still decides. */
  readonly access: UsersAccess;
  allows(rule: AccessRule): boolean;
  refreshSession(): Promise<boolean>;
  syncSessionUser(user: UsersWebSessionUser): void;
  listRoles(): Promise<UsersWebRole[]>;
  changePassword(input: UsersPasswordChange): Promise<UsersPasswordChangeResult>;
}
