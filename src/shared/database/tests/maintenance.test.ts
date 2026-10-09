import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMaintenanceRegistry, type MaintenanceTask } from '../maintenance';

const handles: Array<{ stop(): void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.stop();
  vi.useRealTimers();
});

function start(registry: ReturnType<typeof createMaintenanceRegistry>, options: Parameters<ReturnType<typeof createMaintenanceRegistry>['start']>[0] = {}) {
  const handle = registry.start(options);
  handles.push(handle);
  return handle;
}

describe('Feature-declared maintenance', () => {
  it('runs every task once at start, with the start time', () => {
    const registry = createMaintenanceRegistry();
    const sessions = vi.fn();
    const retention = vi.fn();
    registry.declare('auth', [{ name: 'expired-sessions', everyMs: 1_000, run: sessions }]);
    registry.declare('activity', [{ name: 'retention', everyMs: 2_000, run: retention }]);

    start(registry, { now: 42 });

    expect(sessions).toHaveBeenCalledWith(42);
    expect(retention).toHaveBeenCalledWith(42);
  });

  it('repeats each task on its own interval until stopped', () => {
    vi.useFakeTimers();
    const registry = createMaintenanceRegistry();
    const fast = vi.fn();
    const slow = vi.fn();
    registry.declare('auth', [{ name: 'fast', everyMs: 1_000, run: fast }]);
    registry.declare('activity', [{ name: 'slow', everyMs: 3_000, run: slow }]);

    const handle = start(registry);
    vi.advanceTimersByTime(3_000);
    expect(fast).toHaveBeenCalledTimes(4);
    expect(slow).toHaveBeenCalledTimes(2);

    handle.stop();
    vi.advanceTimersByTime(10_000);
    expect(fast).toHaveBeenCalledTimes(4);
    expect(() => handle.stop()).not.toThrow();
  });

  it('lets a test shorten every interval', () => {
    vi.useFakeTimers();
    const registry = createMaintenanceRegistry();
    const run = vi.fn();
    registry.declare('auth', [{ name: 'hourly', everyMs: 3_600_000, run }]);

    start(registry, { intervalMs: 10 });
    vi.advanceTimersByTime(10);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('reports what a task did, and stays quiet when it did nothing', () => {
    const registry = createMaintenanceRegistry();
    const onResult = vi.fn();
    registry.declare('auth', [
      { name: 'busy', everyMs: 1_000, run: () => ({ removed: 3 }) },
      { name: 'idle', everyMs: 1_000, run: () => undefined },
    ]);

    start(registry, { onResult });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ feature: 'auth', task: 'busy', details: { removed: 3 } });
  });

  it('reports a failing task without stopping the others or throwing', () => {
    vi.useFakeTimers();
    const registry = createMaintenanceRegistry();
    const onFailure = vi.fn();
    const healthy = vi.fn();
    const failure = new Error('disk full');
    registry.declare('activity', [
      {
        name: 'broken',
        everyMs: 1_000,
        run: () => {
          throw failure;
        },
      },
      { name: 'healthy', everyMs: 1_000, run: healthy },
    ]);

    expect(() => start(registry, { onFailure })).not.toThrow();
    vi.advanceTimersByTime(1_000);

    expect(healthy).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledWith({ feature: 'activity', task: 'broken', error: failure });
  });

  // The dev server re-evaluates bindings while this module stays loaded.
  it('replaces a Feature declared again instead of running its tasks twice', () => {
    const registry = createMaintenanceRegistry();
    const first = vi.fn();
    const second = vi.fn();
    registry.declare('activity', [{ name: 'retention', everyMs: 1_000, run: first }]);
    registry.declare('activity', [{ name: 'retention', everyMs: 1_000, run: second }]);

    start(registry);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('refuses two tasks with one name in a Feature, and a non-positive interval', () => {
    const registry = createMaintenanceRegistry();
    const task: MaintenanceTask = { name: 'retention', everyMs: 1_000, run: () => undefined };
    expect(() => registry.declare('activity', [task, task])).toThrow('Maintenance task "activity/retention" is declared twice.');
    expect(() => registry.declare('activity', [{ ...task, everyMs: 0 }])).toThrow(
      'Maintenance task "activity/retention" needs a positive interval.',
    );
  });

  it('keeps one running set: starting again stops the previous timers', () => {
    vi.useFakeTimers();
    const registry = createMaintenanceRegistry();
    const run = vi.fn();
    registry.declare('auth', [{ name: 'tick', everyMs: 1_000, run }]);

    start(registry);
    start(registry);
    run.mockClear();
    vi.advanceTimersByTime(1_000);

    expect(run).toHaveBeenCalledTimes(1);
  });
});
