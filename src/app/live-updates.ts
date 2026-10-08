import { computed, watch } from 'vue';
import type { Router } from 'vue-router';
import { AUTH_ACCOUNT_CHANGED_EVENT, SESSION_ENDED_REASON, useAuthSession } from '../features/auth/web';
import {
  connectServerEvents,
  disconnectServerEvents,
  onServerEvent,
  STREAM_ENDED_EVENT,
} from '../shared/realtime/browser';

/** Wait before reopening a stream the server ended while the session still holds. */
const RECONNECT_DELAY_MS = 5_000;

/**
 * Keeps the open tab in step with the server: listens while someone is signed
 * in, leaves for the login page when the session is ended elsewhere, and
 * re-reads the account when its access changes. Returns the stop function.
 */
export function startLiveUpdates(router: Router): () => void {
  const session = useAuthSession();
  const live = computed(() => session.isAuthenticated.value && session.user.value?.mustChangePassword !== true);
  let reconnect: ReturnType<typeof setTimeout> | undefined;

  async function refreshSession(): Promise<void> {
    try {
      await session.refresh();
    } catch (error) {
      // A transient failure keeps the current state; the next navigation asks again.
      console.error(error);
    }
  }

  async function sessionEnded(): Promise<void> {
    await refreshSession();
    const current = router.currentRoute.value;
    if (!session.isAuthenticated.value) {
      if (current.meta.requiresAuth) {
        await router.replace({ name: 'login', query: { redirect: current.fullPath, reason: SESSION_ENDED_REASON } });
      }
      return;
    }
    // Still signed in: this browser signed in again from another tab, or the
    // stream was refused for capacity. Try again later rather than at once.
    clearTimeout(reconnect);
    reconnect = setTimeout(() => {
      if (live.value) connectServerEvents();
    }, RECONNECT_DELAY_MS);
  }

  async function accountChanged(): Promise<void> {
    await refreshSession();
    const required = router.currentRoute.value.meta.requiresPermission;
    if (typeof required === 'string' && session.isAuthenticated.value && !session.can(required)) {
      await router.replace({ name: 'dashboard' });
    }
  }

  const stopEnded = onServerEvent(STREAM_ENDED_EVENT, () => void sessionEnded());
  const stopChanged = onServerEvent(AUTH_ACCOUNT_CHANGED_EVENT, () => void accountChanged());
  const stopWatching = watch(
    live,
    (on) => {
      clearTimeout(reconnect);
      if (on) connectServerEvents();
      else disconnectServerEvents();
    },
    { immediate: true },
  );

  return () => {
    stopWatching();
    stopEnded();
    stopChanged();
    clearTimeout(reconnect);
    disconnectServerEvents();
  };
}
