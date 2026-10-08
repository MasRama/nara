export type AuthActivityAction =
  | 'auth.registered'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password-changed'
  | 'auth.session-revoked'
  | 'auth.sessions-revoked'
  | 'auth.two-factor-enabled'
  | 'auth.two-factor-disabled'
  | 'auth.recovery-codes-regenerated'
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
