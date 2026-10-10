import { liveTopic, publish } from '../../../shared/realtime';
import { USERS_CHANGED_EVENT, USERS_EDITING_EVENT, type UsersAccess } from '../contract';
import type { UsersServerHost } from './host';

/**
 * Users' live topics, both for whoever may view the directory under the rule
 * its binding chose. `changed` also reaches the accounts it names, whose
 * profile page follows them.
 */
export function usersTopics(access: UsersAccess) {
  return {
    changed: liveTopic(USERS_CHANGED_EVENT, { rule: access.manage('view'), affected: true }),
    editing: liveTopic(USERS_EDITING_EVENT, { rule: access.manage('view') }),
  };
}

/** Tells open Users pages that these accounts changed. */
export function announceAccountsChanged(host: Pick<UsersServerHost, 'access'>, accountIds: string[]): void {
  publish(usersTopics(host.access).changed, accountIds);
}
