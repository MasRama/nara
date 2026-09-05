import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { featureNameIsValid } from '../feature-name';
import { resolveOfficialFeatureDirectory } from '../package-root';
import {
  cleanupStagedLineage,
  copyFeatureFiles,
  digestFeatureFiles,
  lineageDirectory,
  readFeatureFiles,
  stageFeatureLineage,
  type StagedLineage,
} from '../evolution/lineage';

export interface InstalledFeature {
  name: string;
  directory: string;
  files: string[];
  lineageDirectory: string;
  baseDigest: string;
}

export interface FeatureInstallError {
  message: string;
  kind: 'invalid-name' | 'unknown-feature' | 'duplicate' | 'filesystem';
}

export type InstallFeatureResult =
  | { ok: true; feature: InstalledFeature }
  | { ok: false; error: FeatureInstallError };

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

  const source = resolveOfficialFeatureDirectory(name);
  const featuresDirectory = path.resolve(root, 'src', 'features');
  const target = path.resolve(featuresDirectory, name);
  const targetLineage = lineageDirectory(root, name);
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

    if (existsSync(target)) {
      return {
        ok: false,
        error: {
          kind: 'duplicate',
          message: `Feature "${name}" already exists at ${target}; nothing was overwritten.`,
        },
      };
    }
    if (existsSync(targetLineage)) {
      return {
        ok: false,
        error: {
          kind: 'filesystem',
          message: `Lineage already exists without an installed Feature at ${targetLineage}; installation was refused.`,
        },
      };
    }

    const sourceFiles = readFeatureFiles(source, false);
    if (sourceFiles.size === 0) {
      return {
        ok: false,
        error: {
          kind: 'filesystem',
          message: `Official feature package "${name}" is empty.`,
        },
      };
    }
    const baseDigest = digestFeatureFiles(sourceFiles);

    mkdirSync(featuresDirectory, { recursive: true });
    const featureStage = mkdtempSync(path.join(featuresDirectory, '.nara-feature-'));
    let stagedLineage: StagedLineage | undefined;
    let featureInstalled = false;
    let lineageInstalled = false;
    try {
      copyFeatureFiles(sourceFiles, featureStage);
      stagedLineage = stageFeatureLineage(root, name, sourceFiles, baseDigest);

      if (existsSync(target)) {
        rmSync(featureStage, { recursive: true, force: true });
        cleanupStagedLineage(stagedLineage);
        return {
          ok: false,
          error: {
            kind: 'duplicate',
            message: `Feature "${name}" already exists at ${target}; nothing was overwritten.`,
          },
        };
      }
      if (existsSync(targetLineage)) {
        throw new Error(`Lineage already exists at ${targetLineage}.`);
      }

      renameSync(featureStage, target);
      featureInstalled = true;
      renameSync(stagedLineage.directory, targetLineage);
      lineageInstalled = true;
      stagedLineage = undefined;

      return {
        ok: true,
        feature: {
          name,
          directory: target,
          files: [...sourceFiles.keys()].map((file) => path.join(target, ...file.split('/'))),
          lineageDirectory: targetLineage,
          baseDigest,
        },
      };
    } catch (error) {
      if (featureInstalled) rmSync(target, { recursive: true, force: true });
      if (lineageInstalled) rmSync(targetLineage, { recursive: true, force: true });
      rmSync(featureStage, { recursive: true, force: true });
      cleanupStagedLineage(stagedLineage);
      throw error;
    }
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
