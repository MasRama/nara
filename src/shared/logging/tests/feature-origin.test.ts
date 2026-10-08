// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorOriginFeature, featureFromStack } from '../feature-origin';

function withStack(message: string, ...frames: string[]): Error {
  const error = new Error(message);
  error.stack = [`Error: ${message}`, ...frames].join('\n');
  return error;
}

describe('Feature origin from stack frames', () => {
  it('resolves the innermost Feature frame in source and build layouts', () => {
    expect(errorOriginFeature(withStack('x', '    at fn (/repo/src/features/auth/server/totp.ts:40:11)'))).toBe('auth');
    expect(errorOriginFeature(withStack('x', '    at fn (/srv/app/build/src/features/users/server/assets.js:12:3)'))).toBe(
      'users',
    );
    expect(errorOriginFeature(withStack('x', '    at fn (C:\\repo\\src\\features\\multi-tenant\\server\\a.ts:1:1)'))).toBe(
      'multi-tenant',
    );
    expect(errorOriginFeature(withStack('x', '    at /repo/official-features/health/index.ts:5:20'))).toBe('health');
  });

  it('skips shared, framework, and dependency frames above the Feature frame', () => {
    const error = withStack(
      'boom',
      '    at Database.prepare (/repo/node_modules/better-sqlite3/lib/methods/wrappers.js:5:21)',
      '    at fake (/repo/node_modules/some-lib/src/features/billing/x.js:1:1)',
      '    at getDatabase (/repo/src/shared/database/sqlite.ts:31:3)',
      '    at listActivity (/repo/src/features/activity/server/repository.ts:20:5)',
      '    at handler (/repo/src/features/users/server/routes.ts:50:9)',
    );
    expect(errorOriginFeature(error)).toBe('activity');
  });

  it('stays undefined unless a call-site frame proves ownership', () => {
    expect(errorOriginFeature(withStack('read /repo/src/features/auth/x.ts', '    at main (/repo/src/app/server.ts:1:1)'))).toBe(
      undefined,
    );
    expect(errorOriginFeature('not an error')).toBe(undefined);
    expect(featureFromStack(undefined)).toBe(undefined);
  });
});

describe('Logger Feature tagging', () => {
  afterEach(() => {
    vi.doUnmock('pino');
    vi.resetModules();
  });

  /** A fresh Logger whose pino sink records every call. */
  async function recordingLogger() {
    const calls: Array<{ level: string; data: unknown; message: unknown }> = [];
    const record = (level: string) => (data: unknown, message?: unknown) => calls.push({ level, data, message });
    vi.resetModules();
    vi.doMock('pino', () => ({
      default: () => ({ info: record('info'), warn: record('warn'), error: record('error'), fatal: record('fatal') }),
    }));
    const { Logger } = await import('../logger');
    return { Logger, calls };
  }

  it('tags errors with their origin and lets an explicit feature win, even when undefined', async () => {
    const { Logger, calls } = await recordingLogger();
    const fromActivity = withStack('locked', '    at prune (/repo/src/features/activity/server/repository.ts:9:9)');

    Logger.error('direct', fromActivity);
    Logger.fatal('wrapped', { err: fromActivity, requestId: 'r1' });
    Logger.error('explicit', { feature: 'users', err: fromActivity });
    Logger.error('unknown', { feature: undefined, err: fromActivity });

    expect(calls.map(({ data }) => (data as Record<string, unknown>).feature)).toEqual([
      'activity',
      'activity',
      'users',
      undefined,
    ]);
    expect(calls[1]!.data).toMatchObject({ requestId: 'r1', err: fromActivity });
  });

  it('leaves info untagged and omits feature when nothing proves ownership', async () => {
    const { Logger, calls } = await recordingLogger();

    Logger.info('plain');
    Logger.warn('from shared', { count: 1 });

    expect(calls[0]).toEqual({ level: 'info', data: 'plain', message: undefined });
    expect(calls[1]).toEqual({ level: 'warn', data: { count: 1 }, message: 'from shared' });
  });
});
