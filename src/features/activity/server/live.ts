import { liveTopic, publish, type Topic } from '../../../shared/realtime';
import { ACTIVITY_RECORDED_EVENT, type ActivityAccess } from '../contract';
import type { ActivityServerHost } from './host';

/** Activity's live topic, for whoever may read the feed. */
export function activityRecordedTopic(access: ActivityAccess): Topic {
  return liveTopic(ACTIVITY_RECORDED_EVENT, { rule: access.view });
}

/** Tells every connected viewer allowed to read the feed that it changed. */
export function announceActivity(host: Pick<ActivityServerHost, 'access'>): void {
  publish(activityRecordedTopic(host.access));
}
