import type { ReportedActivity } from '../../../shared/security';
import type { AUTH_ACTIVITY, ROLES_ACTIVITY } from '../contract';

export type AuthActivityEvent = ReportedActivity<'auth', typeof AUTH_ACTIVITY>;
export type RolesActivityEvent = ReportedActivity<'roles', typeof ROLES_ACTIVITY>;

/** Optional application-owned side effects; Auth never imports their consumer. */
export type AuthActivitySink = (event: AuthActivityEvent) => void;
export type RolesActivitySink = (event: RolesActivityEvent) => void;
