import { publish, revalidate } from '../../../shared/realtime';
import { AUTH_ACCOUNT_CHANGED_EVENT, AUTH_ROLES_CHANGED_EVENT, AUTH_SESSIONS_CHANGED_EVENT } from '../contract';

// Live consequences of Auth's own writes. Streams of a session that no longer
// resolves end at once; the account's other devices are told its session list
// changed; accounts whose profile, roles, or permissions changed are told to
// refetch who they are; whoever may read roles is told the list changed.

export function sessionEnded(sessionId: string): void {
  revalidate((listener) => listener.sessionId === sessionId);
}

export function sessionsChanged(userIds: Iterable<string>): void {
  const affected = new Set(userIds);
  if (affected.size === 0) return;
  revalidate((listener) => affected.has(listener.userId));
  publish(AUTH_SESSIONS_CHANGED_EVENT, (listener) => affected.has(listener.userId));
}

export function accountsChanged(userIds: Iterable<string>): void {
  const affected = new Set(userIds);
  if (affected.size > 0) publish(AUTH_ACCOUNT_CHANGED_EVENT, (listener) => affected.has(listener.userId));
}

export function rolesChanged(canViewRoles: (userId: string) => boolean): void {
  publish(AUTH_ROLES_CHANGED_EVENT, (listener) => canViewRoles(listener.userId));
}
