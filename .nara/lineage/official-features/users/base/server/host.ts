// Users owns its workflow but not identity/RBAC persistence. The application
// supplies those capabilities through this host; Users never imports Auth.
// Each promise below is part of the contract, not a hint: `describeUsersHost`
// (tests/host-conformance.ts) checks a provider keeps them, so Users relies
// on nothing about the provider that is not written here.
import type { UserProfile, USERS_ACTIVITY, UsersAccess } from '../contract';
import type { AccessRule } from '../../../shared/security/access';
import type { ReportedActivity } from '../../../shared/security/activity';
import type { AssetStorage } from '../../../shared/storage';

export interface UsersActor {
  id: string;
  avatar: string | null;
}

export interface UsersRoleRef {
  id: string;
  slug: string;
  /** Holding it makes an account an administrator, one `allows(id, ADMINISTRATOR)` admits. */
  administrator: boolean;
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

/** `duplicate-email`: another account already uses the email; nothing was written. */
export type UsersAccountCreate = { status: 'created'; account: UserProfile } | { status: 'duplicate-email' };

/**
 * Every update raises the account's revision. `stale` carries the account as
 * it is now and wrote nothing; so does `duplicate-email`, minus the account.
 */
export type UsersAccountUpdate =
  | { status: 'updated'; account: UserProfile }
  | { status: 'stale'; account: UserProfile }
  | { status: 'duplicate-email' }
  | { status: 'missing' };

/** Users always knows who acted and on which account. */
export type UsersActivityEvent = ReportedActivity<'users', typeof USERS_ACTIVITY> & {
  actorId: string;
  targetId: string;
};

export interface UsersIdentityHost {
  /** The signed-in account a session token belongs to; undefined for a missing, unknown, or revoked token. */
  resolveActor(sessionToken: string | undefined): UsersActor | undefined;
  /** Never returns the password itself; the provider later verifies the password against it at sign-in. */
  hashPassword(password: string): Promise<string>;
  findAccountById(userId: string): UserProfile | undefined;
  /** `page` from 1; `search` matches name or email; `total` counts every match, not just this page. */
  listAccounts(page: number, limit: number, search?: string): { data: UserProfile[]; total: number };
  /** With `roleIds`, the account holds exactly those roles. */
  createAccount(input: UsersAccountCreateInput, roleIds?: string[]): UsersAccountCreate;
  /** With `roleIds`, the account's roles are replaced by exactly those. */
  updateAccount(
    userId: string,
    patch: UsersAccountUpdateInput,
    options?: UsersAccountUpdateOptions,
  ): UsersAccountUpdate;

  /** Replaces the password and ends every session of the account; undefined when it does not exist. */
  resetPassword(userId: string, passwordHash: string): UserProfile | undefined;
  /** How many of the accounts existed and are now gone. */
  deleteAccounts(userIds: string[]): number;
}

export interface UsersAuthorizationHost {
  /** The rule each capability requires; Users enforces them through `allows`. */
  readonly access: UsersAccess;
  /** Administrators meet every rule; anyone else meets a permission rule by holding the permission. */
  allows(actorId: string, rule: AccessRule): boolean;
  availableRoles(): UsersRoleRef[];
  /** Slugs of the roles the account holds. */
  rolesForUser(userId: string): string[];
  /** Every account holding an administrator role. */
  administrators(): Array<{ id: string }>;
}

export interface UsersServerHost extends UsersIdentityHost, UsersAuthorizationHost {
  readonly sessionCookieName: string;
  readonly assetStorage: AssetStorage;
  recordActivity?(event: UsersActivityEvent): void;
}
