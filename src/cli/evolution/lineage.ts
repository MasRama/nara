import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface OfficialFeatureLineage {
  schemaVersion: 1;
  feature: string;
  source: 'official-feature';
  baseDigest: string;
}

export interface FeatureLineageSnapshot {
  directory: string;
  baseDirectory: string;
  record: OfficialFeatureLineage;
  files: Map<string, Buffer>;
}

export interface StagedLineage {
  directory: string;
  targetDirectory: string;
  baseDirectory: string;
  record: OfficialFeatureLineage;
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function lineageDirectory(root: string, feature: string): string {
  return path.resolve(root, '.nara', 'lineage', 'official-features', feature);
}

export function lineageBaseDirectory(root: string, feature: string): string {
  return path.join(lineageDirectory(root, feature), 'base');
}

export function lineageRecordPath(root: string, feature: string): string {
  return path.join(lineageDirectory(root, feature), 'lineage.json');
}

function collectFeatureFiles(
  directory: string,
  prefix: string,
  includeHidden: boolean,
  files: Map<string, Buffer>,
): void {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    comparePaths(left.name, right.name),
  );
  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith('.')) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const sourcePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFeatureFiles(sourcePath, relativePath, includeHidden, files);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.set(relativePath, readFileSync(sourcePath));
    } else {
      throw new Error(`Unsupported Feature source entry: ${relativePath}`);
    }
  }
}

/** Read a Feature source tree into relative POSIX paths and exact bytes. */
export function readFeatureFiles(directory: string, includeHidden = true): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  collectFeatureFiles(directory, '', includeHidden, files);
  return files;
}

/** Copy a Feature file map while preserving exact file bytes. */
export function copyFeatureFiles(files: ReadonlyMap<string, Buffer>, targetDirectory: string): void {
  for (const relativePath of [...files.keys()].sort(comparePaths)) {
    const bytes = files.get(relativePath);
    if (bytes === undefined) throw new Error(`Missing Feature source bytes for ${relativePath}.`);
    const targetPath = path.join(targetDirectory, ...relativePath.split('/'));
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, bytes);
  }
}

/** Hash sorted relative paths and exact file bytes without environment metadata. */
export function digestFeatureFiles(files: ReadonlyMap<string, Buffer>): string {
  const digest = createHash('sha256');
  for (const relativePath of [...files.keys()].sort(comparePaths)) {
    const bytes = files.get(relativePath);
    if (bytes === undefined) throw new Error(`Missing Feature source bytes for ${relativePath}.`);
    digest.update(Buffer.from(relativePath, 'utf8'));
    digest.update(Buffer.from([0]));
    digest.update(bytes);
    digest.update(Buffer.from([0]));
  }
  return digest.digest('hex');
}

export function digestFeatureDirectory(directory: string, includeHidden = true): string {
  return digestFeatureFiles(readFeatureFiles(directory, includeHidden));
}

export function featureFilesEqual(left: ReadonlyMap<string, Buffer>, right: ReadonlyMap<string, Buffer>): boolean {
  if (left.size !== right.size) return false;
  for (const [relativePath, bytes] of left) {
    const other = right.get(relativePath);
    if (other === undefined || !bytes.equals(other)) return false;
  }
  return true;
}

function validateLineageRecord(value: unknown, expectedFeature: string, recordPath: string): OfficialFeatureLineage {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Invalid lineage record at ${recordPath}.`);
  }
  const record = value as Partial<OfficialFeatureLineage>;
  if (
    record.schemaVersion !== 1 ||
    record.feature !== expectedFeature ||
    record.source !== 'official-feature' ||
    typeof record.baseDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(record.baseDigest)
  ) {
    throw new Error(`Invalid lineage record at ${recordPath}.`);
  }
  return {
    schemaVersion: 1,
    feature: expectedFeature,
    source: 'official-feature',
    baseDigest: record.baseDigest,
  };
}

export function readFeatureLineage(root: string, feature: string): FeatureLineageSnapshot | undefined {
  const directory = lineageDirectory(root, feature);
  if (!existsSync(directory)) return undefined;
  if (!statSync(directory).isDirectory()) {
    throw new Error(`Lineage path for "${feature}" is not a directory: ${directory}`);
  }

  const recordPath = lineageRecordPath(root, feature);
  if (!existsSync(recordPath)) {
    throw new Error(`Lineage record is missing: ${recordPath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(recordPath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`Could not read lineage record ${recordPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const record = validateLineageRecord(parsed, feature, recordPath);
  const baseDirectory = lineageBaseDirectory(root, feature);
  if (!existsSync(baseDirectory) || !statSync(baseDirectory).isDirectory()) {
    throw new Error(`Lineage base is missing: ${baseDirectory}`);
  }
  const files = readFeatureFiles(baseDirectory);
  const actualDigest = digestFeatureFiles(files);
  if (actualDigest !== record.baseDigest) {
    throw new Error(`Lineage base digest mismatch for "${feature}".`);
  }
  return { directory, baseDirectory, record, files };
}

export function stageFeatureLineage(
  root: string,
  feature: string,
  files: ReadonlyMap<string, Buffer>,
  baseDigest = digestFeatureFiles(files),
): StagedLineage {
  const targetDirectory = lineageDirectory(root, feature);
  const parent = path.dirname(targetDirectory);
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, '.nara-lineage-'));
  try {
    const baseDirectory = path.join(directory, 'base');
    mkdirSync(baseDirectory, { recursive: true });
    copyFeatureFiles(files, baseDirectory);
    const record: OfficialFeatureLineage = {
      schemaVersion: 1,
      feature,
      source: 'official-feature',
      baseDigest,
    };
    writeFileSync(path.join(directory, 'lineage.json'), `${JSON.stringify(record, null, 2)}\n`);
    return { directory, targetDirectory, baseDirectory, record };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export function cleanupStagedLineage(staged: StagedLineage | undefined): void {
  if (staged) rmSync(staged.directory, { recursive: true, force: true });
}

export function temporaryEvolutionDirectory(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'nara-evolve-'));
}
