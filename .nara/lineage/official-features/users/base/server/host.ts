// Users owns its workflow but not identity/RBAC persistence. The application
// supplies those capabilities through this host; Users never imports Auth.
import type { UserProfile, UsersEditor } from '../contract';
import type { AssetStorage } from '../../../shared/storage';

export type UsersManageAction = 'view' | 'create' | 'edit' | 'delete';

export interface UsersActor {
  id: string;
  avatar: string | null;
}

export interface UsersRoleRef {
  id: string;
  slug: string;
}

export interface UsersAccountCreateInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

export interface UsersAccountUpdateInput {
  name?: string;
  email?: string;
  avatar?: string | null;
}

export interface UsersAccountUpdateOptions {
  roleIds?: string[];
  /** Apply only while the account is still at this revision. */
  revision?: number;
}

/** Every update raises the account's revision; `stale` carries the account as it is now and wrote nothing. */
export type UsersAccountUpdate =
  | { status: 'updated'; account: UserProfile }
  | { status: 'stale'; account: UserProfile }
  | { status: 'missing' };

export type UsersActivityAction =
  | 'users.profile-updated'
  | 'users.created'
  | 'users.updated'
  | 'users.password-reset'
  | 'users.deleted';

export interface UsersActivityEvent {
  action: UsersActivityAction;
  resource: 'users';
  actorId: string;
  targetId: string;
  targetLabel?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface UsersIdentityHost {
  resolveActor(sessionToken: string | undefined): UsersActor | undefined;
  hashPassword(password: string): Promise<string>;
  findAccountById(userId: string): UserProfile | undefined;
  listAccounts(page: number, limit: number, search?: string): { data: UserProfile[]; total: number };
  createAccount(input: UsersAccountCreateInput, roleIds?: string[]): UserProfile;
  updateAccount(
    userId: string,
    patch: UsersAccountUpdateInput,
    options?: UsersAccountUpdateOptions,
  ): UsersAccountUpdate;

  resetPassword(userId: string, passwordHash: string): UserProfile | undefined;
  deleteAccounts(userIds: string[]): number;
}

export interface UsersAuthorizationHost {
  canManageUsers(actorId: string, action: UsersManageAction): boolean;
  canAssignRoles(actorId: string): boolean;
  canResetPasswords(actorId: string): boolean;
  availableRoles(): UsersRoleRef[];
  rolesForUser(userId: string): string[];
  usersWithRole(roleId: string): Array<{ id: string }>;
}

/**
 * Live updates, supplied by an application that has them. Without it the
 * pages work the same but follow nobody's changes until they reload.
 */
export interface UsersLiveHost {
  /** Accounts changed through Users: tell whoever may view the directory, and those accounts themselves. */
  accountsChanged(accountIds: string[]): void;
  /** Lists `editor` on the account's edit form; a form renews it while open, and an entry not renewed lapses. */
  startEditing(accountId: string, editor: UsersEditor): void;
  stopEditing(accountId: string, editorId: string): void;
  /** Who is editing each account, keyed by account id. */
  editors(): Record<string, UsersEditor[]>;
}

export interface UsersServerHost extends UsersIdentityHost, UsersAuthorizationHost {
  readonly sessionCookieName: string;
  readonly assetStorage: AssetStorage;
  readonly live?: UsersLiveHost;
  recordActivity?(event: UsersActivityEvent): void;
}
