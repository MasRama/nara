import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';
import { handleError } from '../../src/app/error-handler';
import {
  createApplicationError,
  createValidationError,
} from '../../src/shared/errors';

function createTestApp() {
  const testApp = new Hono();
  testApp.onError(handleError);
  return testApp;
}

describe('v3 error handling', () => {
  it('returns expected application errors as JSON', async () => {
    const testApp = createTestApp();
    testApp.get('/expected', () => {
      throw createApplicationError('Resource not found', 404, 'NOT_FOUND');
    });

    const response = await testApp.request('/expected');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    });
  });

  it('returns validation errors with field diagnostics', async () => {
    const testApp = createTestApp();
    testApp.get('/validation', () => {
      throw createValidationError({ email: ['Invalid email'] });
    });

    const response = await testApp.request('/validation');

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: { email: ['Invalid email'] },
    });
  });

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
