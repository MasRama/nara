import { liveTopic, publish, revalidate } from '../../../shared/realtime';
import {
  AUTH_ACCOUNT_CHANGED_EVENT,
  AUTH_ROLES_CHANGED_EVENT,
  AUTH_ROLES_EDITING_EVENT,
  AUTH_SESSIONS_CHANGED_EVENT,
  rolesAccess,
} from '../contract';

// Live consequences of Auth's own writes. Streams of a session that no longer
// resolves end at once; the account's other devices are told its session list
// changed; accounts whose profile, roles, or permissions changed are told to
// refetch who they are; whoever may read roles is told the list changed.

const accountChangedTopic = liveTopic(AUTH_ACCOUNT_CHANGED_EVENT, { affected: true });
const sessionsChangedTopic = liveTopic(AUTH_SESSIONS_CHANGED_EVENT, { affected: true });
const rolesChangedTopic = liveTopic(AUTH_ROLES_CHANGED_EVENT, { rule: rolesAccess('view') });

/** Who has which role open, for whoever may read roles. */
export const rolesEditingTopic = liveTopic(AUTH_ROLES_EDITING_EVENT, { rule: rolesAccess('view') });

export function sessionEnded(sessionId: string): void {
  revalidate((listener) => listener.sessionId === sessionId);
}

export function sessionsChanged(userIds: Iterable<string>): void {
  const affected = new Set(userIds);
  if (affected.size === 0) return;
  revalidate((listener) => affected.has(listener.userId));
  publish(sessionsChangedTopic, affected);
}

export function accountsChanged(userIds: Iterable<string>): void {
  const affected = new Set(userIds);
  if (affected.size > 0) publish(accountChangedTopic, affected);
}

export function rolesChanged(): void {
  publish(rolesChangedTopic);
}
