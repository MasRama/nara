export interface ActivityServerHost {
  readonly sessionCookieName: string;
  resolveActor(sessionToken: string | undefined): { id: string } | undefined;
  canViewActivity(actorId: string): boolean;
}
