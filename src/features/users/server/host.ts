/**
 * Server-side host requirements for the Users Feature.
 *
 * Users owns its management workflow, profile/admin presentation, and
 * avatar assets — but not account identity data. Identity, credentials,
 * sessions, roles, permissions, and role assignments belong to the
 * identity provider (Auth in the default application). Users reaches
 * accounts only through these operations, supplied by the
 * application-owned binding (`src/app/bindings/users.server.ts`) as plain
 * TypeScript values — no container, no registry, no runtime lookup.
 *
 * The default application binds this host to the Auth Feature. An
 * alternative provider only needs to satisfy these interfaces; Users never
 * imports Auth directly and never touches Auth-owned rows with SQL.
 */
import type { UserProfile } from '../contract';

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
  passwordHash?: string;
  avatar?: string | null;
}

/** Account-directory behavior Users needs but does not own. */
export interface UsersIdentityHost {
  /** Resolve the actor for a session token, or undefined when anonymous. */
  resolveActor(sessionToken: string | undefined): UsersActor | undefined;

  /** One-way password hash for managed user credentials. */
  hashPassword(password: string): string;

  /** Read one account presentation record, or undefined when absent. */
  findAccountById(userId: string): UserProfile | undefined;

  /** Paginated account search over name and email. */
  listAccounts(page: number, limit: number, search?: string): { data: UserProfile[]; total: number };

  /** Create one account with an already-hashed password. */
  createAccount(input: UsersAccountCreateInput): UserProfile;

  /** Patch one account; returns the updated record or undefined when absent. */
  updateAccount(userId: string, patch: UsersAccountUpdateInput): UserProfile | undefined;

  /** Delete accounts by id; returns the removed count. */
  deleteAccounts(userIds: string[]): number;
}

/** Authorization behavior Users needs but does not own. */
export interface UsersAuthorizationHost {
  /** Whether an actor may perform a user-management action. */
  canManageUsers(actorId: string, action: UsersManageAction): boolean;

  /** Whether an actor may assign roles (administrator-level trust). */
  canAssignRoles(actorId: string): boolean;

  /** All roles the host knows about, for slug-to-id assignment. */
  availableRoles(): UsersRoleRef[];

  /** Role slugs currently assigned to a user. */
  rolesForUser(userId: string): string[];

  /** Replace a user's role assignments. */
  setUserRoles(userId: string, roleIds: string[]): void;

  /** Minimal identity rows holding a role, for last-admin protection. */
  usersWithRole(roleId: string): Array<{ id: string }>;
}

export interface UsersServerHost extends UsersIdentityHost, UsersAuthorizationHost {
  /** Cookie carrying the session token the host can resolve. */
  readonly sessionCookieName: string;
}
