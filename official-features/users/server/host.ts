// Users owns its workflow but not identity/RBAC persistence. The application
// supplies those capabilities through this host; Users never imports Auth.
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

/** Users always knows who acted and on which account. */
export type UsersActivityEvent = ReportedActivity<'users', typeof USERS_ACTIVITY> & {
  actorId: string;
  targetId: string;
};

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
  /** The rule each capability requires; Users enforces them through `allows`. */
  readonly access: UsersAccess;
  allows(actorId: string, rule: AccessRule): boolean;
  availableRoles(): UsersRoleRef[];
  rolesForUser(userId: string): string[];
  usersWithRole(roleId: string): Array<{ id: string }>;
}

export interface UsersServerHost extends UsersIdentityHost, UsersAuthorizationHost {
  readonly sessionCookieName: string;
  readonly assetStorage: AssetStorage;
  recordActivity?(event: UsersActivityEvent): void;
}
