import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadConfig() {
  vi.resetModules();
  return (await import('../server/config')).AUTH;
}

describe('auth configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('locks a sign-in dimension after 5 failures within 15 minutes unless configured', async () => {
    vi.stubEnv('AUTH_LOCKOUT_ATTEMPTS', undefined);
    vi.stubEnv('AUTH_LOCKOUT_WINDOW_MS', undefined);
    expect(await loadConfig()).toMatchObject({ LOCKOUT_ATTEMPTS: 5, LOCKOUT_WINDOW_MS: 900_000 });

    vi.stubEnv('AUTH_LOCKOUT_ATTEMPTS', '3');
    vi.stubEnv('AUTH_LOCKOUT_WINDOW_MS', '60000');
    expect(await loadConfig()).toMatchObject({ LOCKOUT_ATTEMPTS: 3, LOCKOUT_WINDOW_MS: 60_000 });
  });

  it('refuses to load with an invalid lockout setting, naming the auth feature', async () => {
    vi.stubEnv('AUTH_LOCKOUT_ATTEMPTS', '0');
    await expect(loadConfig()).rejects.toThrow(/auth feature:\n  - AUTH_LOCKOUT_ATTEMPTS:/);
  });
});
