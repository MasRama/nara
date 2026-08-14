import { describe, it, expect, vi } from 'vitest';
import { mockRequest, mockResponse } from '../helpers/mocks';

import { notFoundPage } from '@handlers/errors';

describe('notFoundPage', () => {
  it('returns 404 and renders the NotFound page', () => {
    const req = mockRequest();
    const res = mockResponse({
      inertia: vi.fn().mockResolvedValue(undefined),
    } as any);
    notFoundPage(req as any, res as any);
    expect(res._status).toBe(404);
    expect(res.inertia).toHaveBeenCalledWith('errors/NotFound');
  });
});
