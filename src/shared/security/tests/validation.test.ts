import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { jsonInput, queryInput } from '..';

const app = new Hono()
  .post('/json', jsonInput(z.object({ name: z.string().min(1, 'Name is required') })), (context) =>
    context.json({ success: true as const, message: 'OK', data: context.req.valid('json') }),
  )
  .get('/query', queryInput(z.object({ page: z.coerce.number().int().min(1).default(1), search: z.string().optional() })), (context) =>
    context.json({ success: true as const, message: 'OK', data: context.req.valid('query') }),
  );

const post = (body: string, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
  app.request('/json', { method: 'POST', headers, body });

describe('request validation middleware', () => {
  it('hands the parsed body to the handler', async () => {
    const response = await post(JSON.stringify({ name: 'Grace', extra: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, message: 'OK', data: { name: 'Grace' } });
  });

  it('validates a malformed or missing body as empty and answers 422', async () => {
    for (const response of [await post('{"name":'), await post('', {}), await post(JSON.stringify({ name: '' }))]) {
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: { name: [expect.any(String)] },
      });
    }
  });

  it('treats empty query values as absent and refuses invalid ones', async () => {
    const defaults = await app.request('/query?page=&search=');
    expect(await defaults.json()).toEqual({ success: true, message: 'OK', data: { page: 1 } });

    const invalid = await app.request('/query?page=zero');
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR', errors: { page: [expect.any(String)] } });
  });
});
