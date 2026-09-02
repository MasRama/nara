import { describe, expect, it } from 'vitest';
import { app } from './server';

describe('v3 application health', () => {
  it('composes the official health Feature', async () => {
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('reports database readiness', async () => {
    const response = await app.request('/ready');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
