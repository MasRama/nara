export type AuthActivityAction =
  | 'auth.registered'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password-changed'
  | 'roles.created'
  | 'roles.updated'
  | 'roles.deleted';

export interface AuthActivityEvent {
  action: AuthActivityAction;
  resource: 'auth' | 'roles';
  actorId: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

/** Optional application-owned side effect; Auth never imports its consumer. */
export type AuthActivitySink = (event: AuthActivityEvent) => void;
