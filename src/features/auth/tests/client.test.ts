import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthClient } from '../web';
import type { RegisterInput } from '../contract';

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('auth API client', () => {
  it('sends a feature contract input to the typed route', async () => {
    document.cookie = 'csrf_token=test-token';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, message: 'Registration successful' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const input: RegisterInput = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'correct horse battery staple',
    };
    const response = await createAuthClient('https://nara.test/api/auth').register(input);

    expect(response).toEqual({ success: true, message: 'Registration successful' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://nara.test/api/auth/register',
      expect.objectContaining({
        body: JSON.stringify(input),
        credentials: 'include',
        method: 'POST',
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Headers | Record<string, string> }];
    const sent = new Headers(init.headers as HeadersInit);
    expect(sent.get('X-CSRF-Token')).toBe('test-token');
  });
});
