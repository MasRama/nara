import { describe, expect, it } from 'vitest';
import { app } from '../../src/app/server';

describe('GET /health', () => {
  it('returns a deterministic status without external services', async () => {
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
