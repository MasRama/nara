import type { ActivityAccess } from '../contract';
import type { AccessRule } from '../../../shared/security/access';

export interface ActivityServerHost {
  readonly sessionCookieName: string;
  resolveActor(sessionToken: string | undefined): { id: string } | undefined;
  /** The rule each capability requires; Activity enforces them through `allows`. */
  readonly access: ActivityAccess;
  allows(actorId: string, rule: AccessRule): boolean;
}
