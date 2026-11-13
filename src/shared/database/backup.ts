import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import type { MaintenanceTask } from './maintenance';

const EXTENSION = '.sqlite3';
const PARTIAL = '.partial';
const SCHEDULED_PREFIX = 'auto';
const HOUR_MS = 60 * 60 * 1000;

/** `2026-11-13T08:00:00.000Z` as `20261113T080000000Z`: sorts by time and is safe in a file name. */
function stamp(time: number): string {
  return new Date(time).toISOString().replaceAll(/[-:.]/g, '');
}

function nextFreePath(directory: string, prefix: string, time: number): string {
  const stem = path.join(directory, `${prefix}-${stamp(time)}`);
  let candidate = `${stem}${EXTENSION}`;
  for (let suffix = 1; existsSync(candidate); suffix += 1) candidate = `${stem}-${suffix}${EXTENSION}`;
  return candidate;
}

/**
 * Snapshots a live database with SQLite's online backup, which is safe while
 * the application writes. The copy takes its final name only once complete,
 * so a file ending in `.sqlite3` is always a whole backup.
 */
export async function writeBackup(
  connection: Database.Database,
  directory: string,
  prefix: string,
  now: number = Date.now(),
): Promise<string> {
  mkdirSync(directory, { recursive: true });
  const destination = nextFreePath(directory, prefix, now);
  const partial = `${destination}${PARTIAL}`;
  rmSync(partial, { force: true });
  await connection.backup(partial);
  renameSync(partial, destination);
  return destination;
}

interface ScheduledBackup {
  name: string;
  time: number;
}

const SCHEDULED_NAME = new RegExp(
  `^${SCHEDULED_PREFIX}-(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})(\\d{3})Z(?:-\\d+)?\\${EXTENSION}$`,
);

/** The scheduled backups in a directory, oldest first. Manual backups carry another prefix and are not listed. */
function scheduledBackups(directory: string): ScheduledBackup[] {
  if (!existsSync(directory)) return [];
  const backups: ScheduledBackup[] = [];
  for (const name of readdirSync(directory)) {
    const match = SCHEDULED_NAME.exec(name);
    if (!match) continue;
    const [year, month, day, hour, minute, second, millisecond] = match.slice(1).map(Number) as [
      number, number, number, number, number, number, number,
    ];
    backups.push({ name, time: Date.UTC(year, month - 1, day, hour, minute, second, millisecond) });
  }
  return backups.sort((left, right) => left.time - right.time || left.name.localeCompare(right.name));
}

function removeInterruptedBackups(directory: string): void {
  if (!existsSync(directory)) return;
  for (const name of readdirSync(directory)) {
    if (name.startsWith(`${SCHEDULED_PREFIX}-`) && name.endsWith(`${EXTENSION}${PARTIAL}`)) {
      rmSync(path.join(directory, name), { force: true });
    }
  }
}

export interface ScheduledBackupOptions {
  /** Read on every run, so the task follows a database that was reopened. */
  connection: () => Database.Database;
  directory: string;
  /** How old the newest scheduled backup may get before the next one is written. */
  everyMs: number;
  /** How many scheduled backups stay; older ones are deleted after each new one. */
  keep: number;
}

/**
 * A maintenance task that keeps recent backups of the database. Whether one
 * is due is read from the files themselves, so a restart neither writes an
 * extra backup nor postpones the next one.
 */
export function scheduledBackupTask(options: ScheduledBackupOptions): MaintenanceTask {
  const { directory, everyMs, keep } = options;
  return {
    name: 'backup',
    // The runner starts a task at boot and then on this interval; looking
    // hourly keeps a backup from running late by most of a long interval.
    everyMs: Math.min(everyMs, HOUR_MS),
    run: async (now) => {
      removeInterruptedBackups(directory);
      const newest = scheduledBackups(directory).at(-1);
      // A backup dated ahead of the clock says nothing about how old the data is.
      if (newest && newest.time <= now && now - newest.time < everyMs) return undefined;

      const file = path.basename(await writeBackup(options.connection(), directory, SCHEDULED_PREFIX, now));
      const removed = scheduledBackups(directory)
        .slice(0, -keep)
        .map((backup) => backup.name);
      for (const name of removed) rmSync(path.join(directory, name), { force: true });
      return removed.length > 0 ? { file, removed } : { file };
    },
  };
}
