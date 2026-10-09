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
  /**
   * Runs `handler` when the server sends `topic` (`USERS_CHANGED_EVENT`,
   * `USERS_EDITING_EVENT`); returns the unsubscribe. `resumed` is true after a
   * dropped connection came back. Without it, pages follow no live changes.
   */
  onLiveEvent?(topic: string, handler: (event: { resumed: boolean }) => void): () => void;
}
