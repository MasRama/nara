import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scheduledBackupTask, writeBackup } from '../backup';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const START = Date.UTC(2026, 10, 13, 8, 0, 0);

let root: string;
let directory: string;
let connection: Database.Database;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'nara-backup-'));
  directory = path.join(root, 'backups');
  connection = new Database(path.join(root, 'live.sqlite3'));
  connection.pragma('journal_mode = WAL');
  connection.exec('CREATE TABLE notes (body TEXT NOT NULL)');
  connection.prepare('INSERT INTO notes (body) VALUES (?)').run('first');
});

afterEach(() => {
  connection.close();
  rmSync(root, { recursive: true, force: true });
});

function files(): string[] {
  return readdirSync(directory).sort();
}

function notesIn(file: string): string[] {
  const copy = new Database(path.join(directory, file), { readonly: true });
  try {
    return (copy.prepare('SELECT body FROM notes ORDER BY rowid').all() as Array<{ body: string }>).map((row) => row.body);
  } finally {
    copy.close();
  }
}

function task(overrides: { everyMs?: number; keep?: number } = {}) {
  return scheduledBackupTask({ connection: () => connection, directory, everyMs: DAY, keep: 3, ...overrides });
}

describe('writeBackup', () => {
  it('snapshots the live database into a timestamped file and leaves nothing half-written', async () => {
    const file = await writeBackup(connection, directory, 'nara', START);

    expect(path.basename(file)).toBe('nara-20261113T080000000Z.sqlite3');
    expect(files()).toEqual(['nara-20261113T080000000Z.sqlite3']);
    expect(notesIn('nara-20261113T080000000Z.sqlite3')).toEqual(['first']);
  });

  it('never overwrites a backup taken in the same millisecond', async () => {
    await writeBackup(connection, directory, 'nara', START);
    connection.prepare('INSERT INTO notes (body) VALUES (?)').run('second');
    await writeBackup(connection, directory, 'nara', START);

    expect(files()).toEqual(['nara-20261113T080000000Z-1.sqlite3', 'nara-20261113T080000000Z.sqlite3']);
    expect(notesIn('nara-20261113T080000000Z.sqlite3')).toEqual(['first']);
    expect(notesIn('nara-20261113T080000000Z-1.sqlite3')).toEqual(['first', 'second']);
  });
});

describe('scheduled backups', () => {
  it('writes the first backup on the first run and reports it', async () => {
    expect(await task().run(START)).toEqual({ file: 'auto-20261113T080000000Z.sqlite3' });
    expect(notesIn('auto-20261113T080000000Z.sqlite3')).toEqual(['first']);
  });

  it('waits until the newest backup is one interval old, also across restarts', async () => {
    await task().run(START);

    // A new task is what a restarted process has: only the files remember.
    expect(await task().run(START + DAY - 1)).toBeUndefined();
    expect(files()).toHaveLength(1);

    expect(await task().run(START + DAY)).toEqual({ file: 'auto-20261114T080000000Z.sqlite3' });
  });

  it('looks for a due backup at least hourly, however long the interval', () => {
    expect(task({ everyMs: DAY }).everyMs).toBe(HOUR);
    expect(task({ everyMs: 10 * 60 * 1000 }).everyMs).toBe(10 * 60 * 1000);
  });

  it('keeps the newest scheduled backups and never touches manual ones', async () => {
    await writeBackup(connection, directory, 'nara', START - 30 * DAY);
    const scheduled = task({ keep: 2 });
    await scheduled.run(START);
    await scheduled.run(START + DAY);

    expect(await scheduled.run(START + 2 * DAY)).toEqual({
      file: 'auto-20261115T080000000Z.sqlite3',
      removed: ['auto-20261113T080000000Z.sqlite3'],
    });
    expect(files()).toEqual([
      'auto-20261114T080000000Z.sqlite3',
      'auto-20261115T080000000Z.sqlite3',
      'nara-20261014T080000000Z.sqlite3',
    ]);
  });

  it('clears a backup an interrupted run left half-written and does not count it', async () => {
    await task().run(START);
    writeFileSync(path.join(directory, 'auto-20261114T080000000Z.sqlite3.partial'), 'half');

    expect(await task().run(START + DAY)).toEqual({ file: 'auto-20261114T080000000Z.sqlite3' });
    expect(files()).toEqual(['auto-20261113T080000000Z.sqlite3', 'auto-20261114T080000000Z.sqlite3']);
    expect(notesIn('auto-20261114T080000000Z.sqlite3')).toEqual(['first']);
  });

  it('backs up again when the newest backup is dated in the future', async () => {
    await task().run(START + 10 * DAY);

    expect(await task().run(START)).toEqual({ file: 'auto-20261113T080000000Z.sqlite3' });
  });
});
