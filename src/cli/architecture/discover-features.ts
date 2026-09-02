import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { featureNameIsValid } from '../feature-name';

export interface DiscoveredFeature {
  name: string;
  directory: string;
  files: string[];
  layers: string[];
  hasPublicIndex: true;
  hasContract: boolean;
}

export interface MalformedFeatureEntry {
  name: string;
  directory: string;
  reason: string;
}

export interface FeatureDiscovery {
  features: DiscoveredFeature[];
  malformed: MalformedFeatureEntry[];
}

function collectFiles(directory: string, prefix = ''): string[] {
  const files: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const relativePath = path.join(prefix, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath, relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function malformedEntry(
  name: string,
  directory: string,
  reason: string,
): MalformedFeatureEntry {
  return { name, directory, reason };
}

export function discoverFeatures(root = process.cwd()): FeatureDiscovery {
  const featuresRoot = path.resolve(root, 'src', 'features');
  if (!existsSync(featuresRoot)) {
    return { features: [], malformed: [] };
  }

  try {
    if (!statSync(featuresRoot).isDirectory()) {
      return {
        features: [],
        malformed: [malformedEntry('features', 'src/features', 'src/features is not a directory')],
      };
    }
  } catch (error) {
    return {
      features: [],
      malformed: [
        malformedEntry(
          'features',
          'src/features',
          `Could not inspect src/features: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
    };
  }

  const features: DiscoveredFeature[] = [];
  const malformed: MalformedFeatureEntry[] = [];
  const entries = readdirSync(featuresRoot, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const directory = path.join('src', 'features', entry.name);
    const absoluteDirectory = path.join(featuresRoot, entry.name);
    if (!entry.isDirectory()) {
      malformed.push(malformedEntry(entry.name, directory, 'feature entry is not a directory'));
      continue;
    }
    if (!featureNameIsValid(entry.name)) {
      malformed.push(malformedEntry(entry.name, directory, 'feature name is not lowercase kebab-case'));
      continue;
    }
    try {
      const files = collectFiles(absoluteDirectory);
      if (!files.includes('index.ts')) {
        malformed.push(malformedEntry(entry.name, directory, 'feature is missing its public index.ts'));
        continue;
      }

      features.push({
        name: entry.name,
        directory,
        files,
        layers: ['server', 'web', 'tests'].filter((layer) =>
          files.some((file) => file.startsWith(`${layer}${path.sep}`)),
        ),
        hasPublicIndex: true,
        hasContract: files.includes('contract.ts'),
      });
    } catch (error) {
      malformed.push(
        malformedEntry(
          entry.name,
          directory,
          `Could not inspect feature: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  return { features, malformed };
}
