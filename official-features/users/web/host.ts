/**
 * Browser-side host requirements for the Users Feature.
 *
 * Users pages need application identity behavior they do not own: the
 * current session, permission checks, role listings, password changes, and
 * CSRF handling. The application-owned web binding
 * (`src/app/bindings/users.web.ts`) supplies one plain `UsersWebHost` value
 * per route via Vue Router `props` — no service container, no global
 * registry, no Nara runtime.
 *
 * The default application binds this host to the Auth Feature. Like the
 * server host, any provider satisfying the interface works; Users web never
 * imports Auth directly.
 */
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

  /** Current session user for display, or null when signed out. */
  currentSessionUser(): UsersWebSessionUser | null;

  /** Permission-gated UI (mirrors the server's authoritative checks). */
  can(permission: string): boolean;

  /** Administrator-level trust for role assignment UI. */
  isAdmin(): boolean;

  /** Re-resolve the session after an unauthorized response. */
  refreshSession(): Promise<boolean>;

  /** Keep displayed session state in sync after profile/avatar updates. */
  syncSessionUser(user: UsersWebSessionUser): void;

  /** Roles available for assignment. */
  listRoles(): Promise<UsersWebRole[]>;

  /**
   * Change the current user's password. Password policy lives with the
   * provider; policy violations arrive as result errors, not exceptions.
   */
  changePassword(input: UsersPasswordChange): Promise<UsersPasswordChangeResult>;
}
