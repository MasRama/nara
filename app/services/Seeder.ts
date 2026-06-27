import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import SQLite from './SQLite';
import Logger from './Logger';

const SEEDS_DIR = join(process.cwd(), 'seeds');

interface Seed {
  run: (sqlite: typeof SQLite) => void;
}

function listSeedFiles(): string[] {
  if (!existsSync(SEEDS_DIR)) return [];
  return readdirSync(SEEDS_DIR)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    .filter(f => !f.endsWith('.d.ts'))
    .sort();
}

function loadSeed(file: string): Seed {
  const fullPath = join(SEEDS_DIR, file);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(fullPath) as Seed;
  if (typeof mod.run !== 'function') {
    throw new Error(`Seed ${file} must export 'run(SQLite)' function`);
  }
  return mod;
}

export function seed(): { applied: string[] } {
  const files = listSeedFiles();
  const applied: string[] = [];

  for (const file of files) {
    const seedFn = loadSeed(file);
    SQLite.transaction(() => {
      seedFn.run(SQLite);
    });
    applied.push(file);
    Logger.info(`Seed applied: ${file}`);
  }

  if (applied.length === 0) {
    Logger.info('No seeds found');
  }

  return { applied };
}

export default { seed };
