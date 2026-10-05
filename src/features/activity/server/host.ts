export interface ActivityActor {
  id: string;
}

export interface ActivityServerHost {
  readonly sessionCookieName: string;
  resolveActor(sessionToken: string | undefined): ActivityActor | undefined;
  canViewActivity(actorId: string): boolean;
}
