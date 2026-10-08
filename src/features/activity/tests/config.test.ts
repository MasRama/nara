import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadConfig() {
  vi.resetModules();
  return (await import('../server/config')).ACTIVITY;
}

describe('activity configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps activity for 365 days unless configured', async () => {
    vi.stubEnv('ACTIVITY_RETENTION_DAYS', undefined);
    expect((await loadConfig()).RETENTION_DAYS).toBe(365);

    vi.stubEnv('ACTIVITY_RETENTION_DAYS', '0');
    expect((await loadConfig()).RETENTION_DAYS).toBe(0);

    vi.stubEnv('ACTIVITY_RETENTION_DAYS', '730');
    expect((await loadConfig()).RETENTION_DAYS).toBe(730);
  });

  it('refuses to load with an invalid retention period, naming the activity feature', async () => {
    vi.stubEnv('ACTIVITY_RETENTION_DAYS', '-1');
    await expect(loadConfig()).rejects.toThrow(/activity feature:\n  - ACTIVITY_RETENTION_DAYS:/);
  });
});
