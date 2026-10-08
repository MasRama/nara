import { publish, revalidate } from '../../../shared/realtime';
import { AUTH_ACCOUNT_CHANGED_EVENT } from '../contract';

// Live consequences of Auth's own writes. Streams of a session that no longer
// resolves end at once; accounts whose profile, roles, or permissions changed
// are told to refetch who they are.

export function sessionEnded(sessionId: string): void {
  revalidate((listener) => listener.sessionId === sessionId);
}

export function sessionsChanged(userIds: Iterable<string>): void {
  const affected = new Set(userIds);
  if (affected.size > 0) revalidate((listener) => affected.has(listener.userId));
}

export function accountsChanged(userIds: Iterable<string>): void {
  const affected = new Set(userIds);
  if (affected.size > 0) publish(AUTH_ACCOUNT_CHANGED_EVENT, (listener) => affected.has(listener.userId));
}
