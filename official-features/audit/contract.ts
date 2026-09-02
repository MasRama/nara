export interface AuditEvent {
  action: string;
  actorId: string | null;
  occurredAt: number;
}

export function createAuditEvent(action: string, actorId: string | null, occurredAt: number): AuditEvent {
  return { action, actorId, occurredAt };
}
