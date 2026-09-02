import { describe, expect, it } from 'vitest';
import { createAuditEvent } from '../index';

describe('official audit feature', () => {
  it('creates an inspectable audit event', () => {
    expect(createAuditEvent('invoice.created', 'user-1', 123)).toEqual({
      action: 'invoice.created',
      actorId: 'user-1',
      occurredAt: 123,
    });
  });
});
