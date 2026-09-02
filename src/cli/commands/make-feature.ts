import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { featureNameIsValid } from '../feature-name';


export interface CreatedFeature {
  name: string;
  directory: string;
  files: string[];
}

export interface FeatureGenerationError {
  message: string;
  kind: 'invalid-name' | 'duplicate' | 'filesystem';
}

export type MakeFeatureResult =
  | { ok: true; feature: CreatedFeature }
  | { ok: false; error: FeatureGenerationError };

export function makeFeature(name: string, root = process.cwd()): MakeFeatureResult {
  if (!featureNameIsValid(name)) {
    return {
      ok: false,
      error: {
        kind: 'invalid-name',
        message: `Invalid feature name "${name}". Use lowercase letters, numbers, and single hyphens; start with a letter.`,
      },
    };
  }

  const featuresDirectory = path.resolve(root, 'src', 'features');
  const featureDirectory = path.resolve(featuresDirectory, name);
  const relativePath = path.relative(featuresDirectory, featureDirectory);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      error: {
        kind: 'invalid-name',
        message: `Invalid feature name "${name}". The target must stay under src/features.`,
      },
    };
  }

  if (existsSync(featureDirectory)) {
    return {
      ok: false,
      error: {
        kind: 'duplicate',
        message: `Feature "${name}" already exists at ${featureDirectory}; nothing was overwritten.`,
      },
    };
  }

  try {
    mkdirSync(featureDirectory, { recursive: true });
    const files = {
      'contract.ts': `export const featureName = '${name}' as const;\nexport type FeatureName = typeof featureName;\n`,
      'index.ts': "export { featureName } from './contract';\n",
    };

    for (const [file, content] of Object.entries(files)) {
      writeFileSync(path.join(featureDirectory, file), content, { encoding: 'utf8', flag: 'wx' });
    }

    return {
      ok: true,
      feature: {
        name,
        directory: featureDirectory,
        files: Object.keys(files).map((file) => path.join(featureDirectory, file)),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'filesystem',
        message: `Could not create feature "${name}": ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

export { featureNameIsValid } from '../feature-name';
