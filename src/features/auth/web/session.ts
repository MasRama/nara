import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue';
import type { AuthError, AuthSuccess, CurrentUser, PublicUser } from '../contract';
import { createAuthClient, type AuthClient } from './client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthSession {
  readonly status: Readonly<Ref<AuthStatus>>;
  readonly user: Readonly<Ref<CurrentUser | null>>;
  readonly isLoading: ComputedRef<boolean>;
  readonly isAuthenticated: ComputedRef<boolean>;
  load(): Promise<void>;
  refresh(): Promise<boolean>;
  setAuthenticated(user: PublicUser | CurrentUser): void;
  can(permission: string): boolean;
  hasRole(role: string): boolean;
  logout(): Promise<AuthSuccess | AuthError>;
}

export function createAuthSession(client: AuthClient = createAuthClient()): AuthSession {
  const status = ref<AuthStatus>('loading');
  const user = ref<CurrentUser | null>(null);
  let loaded = false;
  let currentUserRequest: Promise<boolean> | undefined;

  function setUnauthenticated(): void {
    user.value = null;
    status.value = 'unauthenticated';
    loaded = true;
  }

  async function resolveCurrentUser(): Promise<boolean> {
    const response = await client.me();
    if (!response.success) {
      if (response.code === 'UNAUTHORIZED') {
        setUnauthenticated();
        return false;
      }
      throw new Error(response.message || 'Unable to load the current session');
    }
    if (!response.data) throw new Error('Current session response did not include a user');

    user.value = response.data.user;
    status.value = 'authenticated';
    loaded = true;
    return true;
  }

  function requestCurrentUser(): Promise<boolean> {
    if (currentUserRequest) return currentUserRequest;

    const previousStatus = status.value;
    if (previousStatus !== 'authenticated') status.value = 'loading';
    currentUserRequest = resolveCurrentUser()
      .catch((error: unknown) => {
        // Keep established auth state across transient transport/5xx failures.
        // Only an explicit UNAUTHORIZED response may clear the session.
        status.value = previousStatus;
        throw error;
      })
      .finally(() => {
        currentUserRequest = undefined;
      });
    return currentUserRequest;
  }

  async function load(): Promise<void> {
    if (loaded) return;
    await requestCurrentUser();
  }

  function refresh(): Promise<boolean> {
    return requestCurrentUser();
  }

  function setAuthenticated(nextUser: PublicUser | CurrentUser): void {
    const previousUser = user.value;
    user.value = {
      ...nextUser,
      roles: 'roles' in nextUser ? nextUser.roles : previousUser?.roles ?? [],
      permissions: 'permissions' in nextUser ? nextUser.permissions : previousUser?.permissions ?? [],
    };
    status.value = 'authenticated';
    loaded = true;
  }

  function can(permission: string): boolean {
    const currentUser = user.value;
    return currentUser?.roles.includes('admin') === true || currentUser?.permissions.includes(permission) === true;
  }

  function hasRole(role: string): boolean {
    return user.value?.roles.includes(role) === true;
  }

  async function logout(): Promise<AuthSuccess | AuthError> {
    const response = await client.logout();
    if (response.success) setUnauthenticated();
    return response;
  }

  return {
    status: readonly(status),
    user: readonly(user),
    isLoading: computed(() => status.value === 'loading'),
    isAuthenticated: computed(() => status.value === 'authenticated'),
    load,
    refresh,
    setAuthenticated,
    can,
    hasRole,
    logout,
  };
}

const applicationSession = createAuthSession();

export function useAuthSession(): AuthSession {
  return applicationSession;
}
