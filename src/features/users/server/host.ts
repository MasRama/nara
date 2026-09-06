/**
 * Server-side host requirements for the Users Feature.
 *
 * Users needs identity and authorization behavior it does not own: resolving
 * the current actor from a session token, hashing managed passwords, and
 * reading/assigning role-based permissions. Those capabilities are supplied
 * by the application-owned binding (`src/app/bindings/users.server.ts`) as
 * plain TypeScript values — no container, no registry, no runtime lookup.
 *
 * The default application binds this host to the Auth Feature. An
 * alternative provider only needs to satisfy this interface; Users never
 * imports Auth directly.
 */
export type UsersManageAction = 'view' | 'create' | 'edit' | 'delete';

export interface UsersActor {
  id: string;
  avatar: string | null;
}

export interface UsersRoleRef {
  id: string;
  slug: string;
}

export interface UsersServerHost {
  /** Cookie carrying the session token the host can resolve. */
  readonly sessionCookieName: string;

  /** Resolve the actor for a session token, or undefined when anonymous. */
  resolveActor(sessionToken: string | undefined): UsersActor | undefined;

  /** One-way password hash for managed user credentials. */
  hashPassword(password: string): string;

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
