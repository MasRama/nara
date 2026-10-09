import { publish } from '../../../shared/realtime';
import { ACTIVITY_RECORDED_EVENT } from '../contract';
import type { ActivityServerHost } from './host';

/** Tells every connected viewer allowed to read the feed that it changed. */
export function announceActivity(host: Pick<ActivityServerHost, 'canViewActivity'>): void {
  publish(ACTIVITY_RECORDED_EVENT, (listener) => host.canViewActivity(listener.userId));
}
