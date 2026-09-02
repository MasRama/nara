import { discoverFeatureDependencies, type FeatureDependency } from './discover-dependencies';

export interface BoundaryViolation {
  code: 'CROSS_FEATURE_INTERNAL_IMPORT';
  sourceFeature: string;
  targetFeature: string;
  sourceFile: string;
  importSpecifier: string;
  message: string;
  suggestion: string;
}

function usesInternalPath(specifier: string, targetFeature: string): boolean {
  const normalized = specifier.replaceAll('\\', '/');
  const marker = `/${targetFeature}`;
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) {
    return false;
  }

  const suffix = normalized.slice(markerIndex + marker.length).replace(/^\/+/, '');
  return suffix.length > 0 && !/^index(?:\.[cm]?[jt]sx?)?$/.test(suffix);
}

function internalImports(dependency: FeatureDependency): string[] {
  return dependency.imports.filter((specifier) => usesInternalPath(specifier, dependency.to));
}

export function detectCrossFeatureInternalImports(root = process.cwd()): BoundaryViolation[] {
  const { dependencies } = discoverFeatureDependencies(root);
  const violations: BoundaryViolation[] = [];

  for (const dependency of dependencies) {
    const imports = internalImports(dependency);
    for (const sourceFile of dependency.sourceFiles) {
      for (const importSpecifier of imports) {
        violations.push({
          code: 'CROSS_FEATURE_INTERNAL_IMPORT',
          sourceFeature: dependency.from,
          targetFeature: dependency.to,
          sourceFile,
          importSpecifier,
          message: `Feature "${dependency.from}" imports internal feature code from "${dependency.to}" in ${sourceFile}.`,
          suggestion: `Import the public interface from "@/features/${dependency.to}" instead of "${importSpecifier}".`,
        });
      }
    }
  }

  return violations.sort(
    (left, right) =>
      left.sourceFeature.localeCompare(right.sourceFeature) ||
      left.targetFeature.localeCompare(right.targetFeature) ||
      left.sourceFile.localeCompare(right.sourceFile) ||
      left.importSpecifier.localeCompare(right.importSpecifier),
  );
}
