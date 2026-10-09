import { publish } from '../../../shared/realtime';
import { USERS_CHANGED_EVENT } from '../contract';
import type { UsersServerHost } from './host';

/**
 * Tells open Users pages that accounts changed: whoever may view the
 * directory, and those accounts themselves, whose profile page follows them.
 */
export function announceAccountsChanged(host: UsersServerHost, accountIds: string[]): void {
  const affected = new Set(accountIds);
  publish(USERS_CHANGED_EVENT, (listener) => affected.has(listener.userId) || host.canManageUsers(listener.userId, 'view'));
}
