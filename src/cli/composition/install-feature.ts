import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { featureNameIsValid } from '../feature-name';

export interface InstalledFeature {
  name: string;
  directory: string;
  files: string[];
}

export interface FeatureInstallError {
  message: string;
  kind: 'invalid-name' | 'unknown-feature' | 'duplicate' | 'filesystem';
}

export type InstallFeatureResult =
  | { ok: true; feature: InstalledFeature }
  | { ok: false; error: FeatureInstallError };

function officialFeatureDirectory(name: string): string {
  const candidates = [
    path.resolve(__dirname, '../../../official-features', name),
    path.resolve(__dirname, '../../../../official-features', name),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function packageFiles(directory: string, prefix = ''): string[] {
  const files: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const relativePath = path.join(prefix, entry.name);
    const sourcePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...packageFiles(sourcePath, relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

function copyPackage(source: string, target: string, files: string[]): void {
  for (const file of files) {
    const targetPath = path.join(target, file);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, readFileSync(path.join(source, file)), { flag: 'wx' });
  }
}

export function installOfficialFeature(name: string, root = process.cwd()): InstallFeatureResult {
  if (!featureNameIsValid(name)) {
    return {
      ok: false,
      error: {
        kind: 'invalid-name',
        message: `Invalid feature name "${name}". Use lowercase letters, numbers, and single hyphens; start with a letter.`,
      },
    };
  }

  const source = officialFeatureDirectory(name);
  try {
    if (!existsSync(source) || !statSync(source).isDirectory()) {
      return {
        ok: false,
        error: {
          kind: 'unknown-feature',
          message: `No official feature package named "${name}" was found.`,
        },
      };
    }

    const featuresDirectory = path.resolve(root, 'src', 'features');
    const target = path.resolve(featuresDirectory, name);
    if (existsSync(target)) {
      return {
        ok: false,
        error: {
          kind: 'duplicate',
          message: `Feature "${name}" already exists at ${target}; nothing was overwritten.`,
        },
      };
    }

    const files = packageFiles(source);
    if (files.length === 0) {
      return {
        ok: false,
        error: {
          kind: 'filesystem',
          message: `Official feature package "${name}" is empty.`,
        },
      };
    }

    mkdirSync(featuresDirectory, { recursive: true });
    const temporaryDirectory = mkdtempSync(path.join(featuresDirectory, '.nara-feature-'));
    try {
      copyPackage(source, temporaryDirectory, files);
      if (existsSync(target)) {
        rmSync(temporaryDirectory, { recursive: true, force: true });
        return {
          ok: false,
          error: {
            kind: 'duplicate',
            message: `Feature "${name}" already exists at ${target}; nothing was overwritten.`,
          },
        };
      }
      renameSync(temporaryDirectory, target);
    } catch (error) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }

    return {
      ok: true,
      feature: {
        name,
        directory: target,
        files: files.map((file) => path.join(target, file)),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'filesystem',
        message: `Could not install feature "${name}": ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}
