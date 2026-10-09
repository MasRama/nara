/**
 * Periodic upkeep a Feature owns on its own tables: deleting expired rows,
 * pruning history. The Feature exports its tasks; whoever composes it
 * declares them, and the application runtime starts them after migrations.
 * In-process timers only: no queue, no persistence, no retries.
 */
export interface MaintenanceTask {
  name: string;
  everyMs: number;
  /** Return details worth logging; nothing when there was nothing to do. */
  run(now: number): Record<string, unknown> | void;
}

export interface MaintenanceResult {
  feature: string;
  task: string;
  details: Record<string, unknown>;
}

export interface MaintenanceFailure {
  feature: string;
  task: string;
  error: Error;
}

export interface MaintenanceStartOptions {
  /** Start time handed to the first run; later runs get `Date.now()`. */
  now?: number;
  /** Replaces every task's interval, for tests that cannot wait an hour. */
  intervalMs?: number;
  onResult?: (result: MaintenanceResult) => void;
  onFailure?: (failure: MaintenanceFailure) => void;
}

export interface MaintenanceHandle {
  stop(): void;
}

const MAX_TIMER_MS = 2_147_483_647;

export function createMaintenanceRegistry() {
  const declared = new Map<string, readonly MaintenanceTask[]>();
  let running: MaintenanceHandle | undefined;

  // A Feature declared again replaces its earlier tasks: the dev server
  // re-evaluates bindings while this module stays loaded.
  function declare(feature: string, tasks: readonly MaintenanceTask[]): void {
    const names = new Set<string>();
    for (const task of tasks) {
      if (names.has(task.name)) throw new Error(`Maintenance task "${feature}/${task.name}" is declared twice.`);
      if (!(task.everyMs > 0)) throw new Error(`Maintenance task "${feature}/${task.name}" needs a positive interval.`);
      // A longer delay overflows the timer, which then fires every millisecond.
      if (!(task.everyMs <= MAX_TIMER_MS)) {
        throw new Error(`Maintenance task "${feature}/${task.name}" needs an interval of at most ${MAX_TIMER_MS} ms.`);
      }
      names.add(task.name);
    }
    declared.set(feature, [...tasks]);
  }

  /** Runs every declared task once now, then on its interval. Starting again replaces the running set. */
  function start(options: MaintenanceStartOptions = {}): MaintenanceHandle {
    running?.stop();
    const timers: ReturnType<typeof setInterval>[] = [];

    for (const [feature, tasks] of declared) {
      for (const task of tasks) {
        const runOnce = (now: number) => {
          try {
            const details = task.run(now);
            if (details && Object.keys(details).length > 0) options.onResult?.({ feature, task: task.name, details });
          } catch (error) {
            options.onFailure?.({ feature, task: task.name, error: error instanceof Error ? error : new Error(String(error)) });
          }
        };
        runOnce(options.now ?? Date.now());
        const timer = setInterval(() => runOnce(Date.now()), options.intervalMs ?? task.everyMs);
        // Upkeep never keeps the process alive on its own.
        timer.unref?.();
        timers.push(timer);
      }
    }

    const handle: MaintenanceHandle = {
      stop: () => {
        for (const timer of timers.splice(0)) clearInterval(timer);
        if (running === handle) running = undefined;
      },
    };
    running = handle;
    return handle;
  }

  return { declare, start };
}

const registry = createMaintenanceRegistry();

/** Declare a Feature's maintenance while composing the application. */
export function declareMaintenance(feature: string, tasks: readonly MaintenanceTask[]): void {
  registry.declare(feature, tasks);
}

/** Start every declared task; the application runtime calls this after migrations. */
export function startMaintenance(options?: MaintenanceStartOptions): MaintenanceHandle {
  return registry.start(options);
}
