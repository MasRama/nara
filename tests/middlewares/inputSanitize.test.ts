/**
 * Tests for Input Sanitize Middleware
 *
 * Validates HTML tag stripping on body/query and that
 * credential fields (password*) are never mutated.
 */

import { describe, it, expect, vi } from 'vitest';
import { inputSanitize } from '../../app/middlewares/inputSanitize';
import { mockRequest, mockResponse, runMiddleware } from '../helpers/mocks';

vi.mock('@services/Logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), logSecurity: vi.fn() },
}));

describe('inputSanitize middleware', () => {
  it('strips HTML tags from body strings', async () => {
    const req = mockRequest({ body: { name: '<b>Admin</b>', note: 'hello <script>x</script>' } });
    const res = mockResponse();

    await runMiddleware(inputSanitize(), req as any, res as any);

    expect(req.body.name).toBe('Admin');
    expect(req.body.note).toBe('hello x');
  });

  it('strips tags recursively in nested objects and arrays', async () => {
    const req = mockRequest({
      body: {
        items: [{ label: '<i>One</i>' }, { label: 'Two' }],
        meta: { title: '<h1>T</h1>' },
      },
    });
    const res = mockResponse();

    await runMiddleware(inputSanitize(), req as any, res as any);

    expect(req.body.items[0].label).toBe('One');
    expect(req.body.items[1].label).toBe('Two');
    expect(req.body.meta.title).toBe('T');
  });

  it('never mutates password fields', async () => {
    const body = {
      password: 'p@ss<word>',
      new_password: 'a>b',
      current_password: '<secret>',
      password_confirmation: 'a>b',
      email: 'a<b>@x.dev',
    };
    const req = mockRequest({ body });
    const res = mockResponse();

    await runMiddleware(inputSanitize(), req as any, res as any);

    expect(req.body.password).toBe('p@ss<word>');
    expect(req.body.new_password).toBe('a>b');
    expect(req.body.current_password).toBe('<secret>');
    expect(req.body.password_confirmation).toBe('a>b');
    expect(req.body.email).toBe('a@x.dev');
  });

  it('sanitizes query parameters', async () => {
    const req = mockRequest({ query: { q: '<b>search</b>' } });
    const res = mockResponse();

    await runMiddleware(inputSanitize(), req as any, res as any);

    expect(req.query.q).toBe('search');
  });

  it('calls next() to continue middleware chain', async () => {
    const result = await runMiddleware(inputSanitize());
    expect(result.nextCalled).toBe(true);
  });
});
