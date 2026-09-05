import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  collectStaticModuleSpecifiers,
  discoverFeatureImportEvidence,
  featureReferenceFromSpecifier,
  isBrowserFeatureSpecifier,
} from './discover-import-evidence';
import { discoverFeatures } from './discover-features';

export interface BoundaryViolation {
  code: 'CROSS_FEATURE_INTERNAL_IMPORT';
  boundary: 'general' | 'browser';
  sourceFeature: string;
  targetFeature: string;
  sourceFile: string;
  importSpecifier: string;
  message: string;
  suggestion: string;
}

export interface ApplicationBoundaryViolation {
  code: 'APPLICATION_FEATURE_INTERNAL_IMPORT';
  targetFeature: string;
  sourceFile: string;
  importSpecifier: string;
  message: string;
  suggestion: string;
}

const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?|vue)$/;

function collectSourceFiles(directory: string, prefix = ''): string[] {
  if (!existsSync(directory)) {
    return [];
  }

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
      files.push(...collectSourceFiles(absolutePath, relativePath));
    } else if (SOURCE_FILE_PATTERN.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function publicBoundarySuggestion(specifier: string, targetFeature: string): string {
  const boundary = isBrowserFeatureSpecifier(specifier, targetFeature) ? '/web' : '';
  const interfaceName = boundary ? 'browser-safe public interface' : 'public interface';
  return `Import the ${interfaceName} from "@/features/${targetFeature}${boundary}" instead of "${specifier}".`;
}

export function detectCrossFeatureInternalImports(root = process.cwd()): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const evidence of discoverFeatureImportEvidence(root)) {
    if (!evidence.usesInternalPath) {
      continue;
    }

    violations.push({
      code: 'CROSS_FEATURE_INTERNAL_IMPORT',
      boundary: isBrowserFeatureSpecifier(evidence.specifier, evidence.to) ? 'browser' : 'general',
      sourceFeature: evidence.from,
      targetFeature: evidence.to,
      sourceFile: evidence.sourceFile,
      importSpecifier: evidence.specifier,
      message: `Feature "${evidence.from}" imports internal feature code from "${evidence.to}" in ${evidence.sourceFile}.`,
      suggestion: publicBoundarySuggestion(evidence.specifier, evidence.to),
    });
  }

  return violations.sort(
    (left, right) =>
      left.sourceFeature.localeCompare(right.sourceFeature) ||
      left.targetFeature.localeCompare(right.targetFeature) ||
      left.sourceFile.localeCompare(right.sourceFile) ||
      left.importSpecifier.localeCompare(right.importSpecifier),
  );
}

export function detectApplicationFeatureInternalImports(root = process.cwd()): ApplicationBoundaryViolation[] {
  const knownFeatures = new Set(discoverFeatures(root).features.map((feature) => feature.name));
  const applicationRoot = path.resolve(root, 'src', 'app');
  const violations: ApplicationBoundaryViolation[] = [];

  for (const sourceFile of collectSourceFiles(applicationRoot)) {
    let specifiers: string[];
    try {
      specifiers = collectStaticModuleSpecifiers(sourceFile);
    } catch {
      continue;
    }

    for (const specifier of specifiers) {
      const reference = featureReferenceFromSpecifier(specifier, sourceFile, root);
      if (!reference || !knownFeatures.has(reference.name) || !reference.usesInternalPath) {
        continue;
      }

      const relativeSourceFile = path.relative(root, sourceFile).replaceAll(path.sep, '/');
      violations.push({
        code: 'APPLICATION_FEATURE_INTERNAL_IMPORT',
        targetFeature: reference.name,
        sourceFile: relativeSourceFile,
        importSpecifier: specifier,
        message: `Application code imports internal feature code from "${reference.name}" in ${relativeSourceFile}.`,
        suggestion: publicBoundarySuggestion(specifier, reference.name),
      });
    }
  }

  return violations.sort(
    (left, right) =>
      left.targetFeature.localeCompare(right.targetFeature) ||
      left.sourceFile.localeCompare(right.sourceFile) ||
      left.importSpecifier.localeCompare(right.importSpecifier),
  );
}
