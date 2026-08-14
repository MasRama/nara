/**
 * Handler tests — home.ts
 *
 * Pattern mirrors tests/handlers/roles.test.ts:
 * 1. Mock @queries (landingPage reads user by session cookie)
 * 2. Use mockRequest/mockResponse from tests/helpers/mocks
 * 3. Call handler, assert inertia props
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse } from '../helpers/mocks';

vi.mock('@queries', () => ({
  getUserBySessionId: vi.fn(),
}));

import { landingPage } from '../../app/handlers/home';
import { getUserBySessionId } from '@queries';

const USER = { id: 'user-1', name: 'Test User', email: 'test@nara.dev', avatar: null, roles: ['user'] };

describe('landingPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders landing with empty user when no session cookie', () => {
    const req = mockRequest();
    const res = mockResponse({ inertia: vi.fn().mockResolvedValue(undefined) } as any);
    landingPage(req as any, res as any);
    expect(res.inertia).toHaveBeenCalledWith('landing', { user: {} });
    expect(getUserBySessionId).not.toHaveBeenCalled();
  });

  it('renders landing with user from valid session cookie', () => {
    (getUserBySessionId as any).mockReturnValue(USER);
    const req = mockRequest({ cookies: { auth_id: 'session-1' } });
    const res = mockResponse({ inertia: vi.fn().mockResolvedValue(undefined) } as any);
    landingPage(req as any, res as any);
    expect(getUserBySessionId).toHaveBeenCalledWith('session-1');
    expect(res.inertia).toHaveBeenCalledWith('landing', { user: USER });
  });

  it('renders landing with empty user for invalid session', () => {
    (getUserBySessionId as any).mockReturnValue(undefined);
    const req = mockRequest({ cookies: { auth_id: 'expired-session' } });
    const res = mockResponse({ inertia: vi.fn().mockResolvedValue(undefined) } as any);
    landingPage(req as any, res as any);
    expect(res.inertia).toHaveBeenCalledWith('landing', { user: {} });
  });
});
