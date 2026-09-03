import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue';
import type { AuthError, AuthSuccess, PublicUser } from '../contract';
import { createAuthClient, type AuthClient } from './client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthSession {
  readonly status: Readonly<Ref<AuthStatus>>;
  readonly user: Readonly<Ref<PublicUser | null>>;
  readonly isLoading: ComputedRef<boolean>;
  readonly isAuthenticated: ComputedRef<boolean>;
  load(): Promise<void>;
  refresh(): Promise<boolean>;
  setAuthenticated(user: PublicUser): void;
  logout(): Promise<AuthSuccess | AuthError>;
}

export function createAuthSession(client: AuthClient = createAuthClient()): AuthSession {
  const status = ref<AuthStatus>('loading');
  const user = ref<PublicUser | null>(null);
  let loaded = false;
  let currentUserRequest: Promise<boolean> | undefined;

  function setUnauthenticated(): void {
    user.value = null;
    status.value = 'unauthenticated';
    loaded = true;
  }

  async function resolveCurrentUser(): Promise<boolean> {
    try {
      const response = await client.me();
      if (!response.success || !response.data) {
        setUnauthenticated();
        return false;
      }

      user.value = response.data.user;
      status.value = 'authenticated';
      return true;
    } catch (error) {
      setUnauthenticated();
      throw error;
    }
  }

  function requestCurrentUser(): Promise<boolean> {
    if (currentUserRequest) return currentUserRequest;

    status.value = 'loading';
    currentUserRequest = resolveCurrentUser().finally(() => {
      loaded = true;
      currentUserRequest = undefined;
    });
    return currentUserRequest;
  }

  async function load(): Promise<void> {
    if (loaded) return;

    try {
      await requestCurrentUser();
    } catch {
      // A failed or expired browser session is treated as unauthenticated.
    }
  }

  function refresh(): Promise<boolean> {
    return requestCurrentUser();
  }

  function setAuthenticated(nextUser: PublicUser): void {
    user.value = nextUser;
    status.value = 'authenticated';
    loaded = true;
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
    logout,
  };
}

const applicationSession = createAuthSession();

export function useAuthSession(): AuthSession {
  return applicationSession;
}
