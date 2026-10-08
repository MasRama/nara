// Browser capabilities Users needs but does not own. The application binds
// these to its identity provider; Users web never imports Auth directly.
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
  /** The provider's refusal code, so Users can show the refusal in the interface language. */
  code?: string;
  errors?: Record<string, string[]>;
}

export interface UsersWebHost {
  readonly csrf: UsersWebCsrf;
  currentSessionUser(): UsersWebSessionUser | null;
  can(permission: string): boolean;
  isAdmin(): boolean;
  refreshSession(): Promise<boolean>;
  syncSessionUser(user: UsersWebSessionUser): void;
  listRoles(): Promise<UsersWebRole[]>;
  changePassword(input: UsersPasswordChange): Promise<UsersPasswordChangeResult>;
}
