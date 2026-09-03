import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getDatabase } from './sqlite';

interface SeedModule {
  run(database: Database.Database): void;
}

export interface SeedFile {
  name: string;
  path: string;
}

export interface SeederOptions {
  database?: Database.Database;
  root?: string;
  featureRoots?: string[];
}

export interface SeedResult {
  applied: string[];
}

function seedRoots(options: SeederOptions): string[] {
  if (options.featureRoots) {
    return [...new Set(options.featureRoots.map((root) => path.resolve(root)))];
  }

  if (options.root) {
    return [path.resolve(options.root, 'src', 'features')];
  }

  const sourceRoot = path.resolve(process.cwd(), 'src', 'features');
  const runtimeRoot = path.resolve(__dirname, '..', '..', 'features');
  return [existsSync(runtimeRoot) ? runtimeRoot : sourceRoot];
}

function readSeedFiles(root: string): SeedFile[] {
  if (!existsSync(root)) return [];

  const seeds: SeedFile[] = [];
  const features = readdirSync(root, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const feature of features) {
    if (!feature.isDirectory() || feature.name.startsWith('.')) continue;

    const directory = path.join(root, feature.name, 'server', 'seeds');
    if (!existsSync(directory)) continue;

    const files = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const file of files) {
      if (!file.isFile() || file.name.endsWith('.d.ts')) continue;
      if (!file.name.endsWith('.ts') && !file.name.endsWith('.js')) continue;
      seeds.push({ name: file.name, path: path.join(directory, file.name) });
    }
  }

  return seeds.sort((left, right) => left.path.localeCompare(right.path));
}

export function discoverSeeds(options: SeederOptions = {}): SeedFile[] {
  return seedRoots(options).flatMap((root) => readSeedFiles(root)).sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

function loadSeed(file: SeedFile): SeedModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded = require(file.path) as SeedModule & { default?: SeedModule };
  const seed = typeof loaded.run === 'function' ? loaded : loaded.default;
  if (!seed || typeof seed.run !== 'function') {
    throw new Error(`Seed "${file.path}" must export a run(database) function.`);
  }
  return seed;
}

function optionsDatabase(options: SeederOptions): Database.Database {
  return options.database ?? getDatabase();
}

export function seed(options: SeederOptions = {}): SeedResult {
  const database = optionsDatabase(options);
  const files = discoverSeeds(options);
  const applied: string[] = [];

  for (const file of files) {
    const seedModule = loadSeed(file);
    try {
      const run = database.transaction(() => seedModule.run(database));
      run();
    } catch (error) {
      throw new Error(
        `Seed "${file.name}" failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    applied.push(file.name);
  }

  return { applied };
}

export default { discoverSeeds, seed };
