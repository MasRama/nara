import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse } from '../helpers/mocks';

vi.mock('@queries', () => ({
  pingDatabase: vi.fn(),
}));

import { healthCheck, readyCheck } from '@handlers/health';
import { pingDatabase } from '@queries';

describe('health handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('healthCheck returns 200 OK', () => {
    const req = mockRequest();
    const res = mockResponse();
    healthCheck(req as any, res as any);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ success: true, message: 'OK' });
  });

  it('readyCheck returns 200 when database responds', () => {
    (pingDatabase as any).mockReturnValue(true);
    const req = mockRequest();
    const res = mockResponse();
    readyCheck(req as any, res as any);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ success: true, message: 'OK' });
  });

  it('readyCheck returns 503 when database is down', () => {
    (pingDatabase as any).mockReturnValue(false);
    const req = mockRequest();
    const res = mockResponse();
    readyCheck(req as any, res as any);
    expect(res._status).toBe(503);
    expect(res._body).toEqual({ success: false, message: 'Database unavailable', code: 'DB_UNAVAILABLE' });
  });
});
