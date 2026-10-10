import { describe, expect, it } from 'vitest';
import { healthRoutes } from '../index';

describe('official health feature', () => {
  it('returns a healthy response', async () => {
    const response = await healthRoutes.request('/');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
