import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';
import { handleError } from '../../src/app/error-handler';

function createTestApp() {
  const testApp = new Hono();
  testApp.onError(handleError);
  return testApp;
}

describe('error handling', () => {
  it('handles Hono HTTP exceptions without exposing internals', async () => {
    const testApp = createTestApp();
    testApp.get('/forbidden', () => {
      throw new HTTPException(403, { message: 'Forbidden' });
    });

    const response = await testApp.request('/forbidden');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Forbidden',
      code: 'APPLICATION_ERROR',
    });
  });

  it('hides unexpected error details', async () => {
    const testApp = createTestApp();
    testApp.get('/unexpected', () => {
      throw new Error('database password leaked');
    });

    const response = await testApp.request('/unexpected');
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(body)).not.toContain('database password leaked');
  });
});
