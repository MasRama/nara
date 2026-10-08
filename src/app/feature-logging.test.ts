// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('pino');
  vi.resetModules();
});

it('tags a warning logged from real Feature code with that Feature, undeclared', async () => {
  const calls: Array<{ level: string; data: unknown; message: unknown }> = [];
  const record = (level: string) => (data: unknown, message?: unknown) => calls.push({ level, data, message });
  vi.resetModules();
  vi.doMock('pino', () => ({
    default: () => ({ info: record('info'), warn: record('warn'), error: record('error'), fatal: record('fatal') }),
  }));
  const { migrate } = await import('../shared/database');
  migrate();
  const { createAuthRoutes } = await import('../features/auth');

  const response = await createAuthRoutes().request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password' }),
  });

  expect(response.status).toBe(401);
  expect(calls).toContainEqual({
    level: 'warn',
    message: 'Security: login_failed',
    data: { email: 'nobody@example.com', feature: 'auth' },
  });
});
