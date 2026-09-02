import { detectCrossFeatureInternalImports } from './validate-boundaries';
import { detectFeatureDependencyCycles } from './detect-cycles';
import { detectServerClientLeaks } from './detect-client-leaks';
import { discoverFeatures } from './discover-features';

export type DoctorIssueCode =
  | 'INVALID_FEATURE_SHAPE'
  | 'CROSS_FEATURE_INTERNAL_IMPORT'
  | 'CIRCULAR_FEATURE_DEPENDENCY'
  | 'SERVER_CLIENT_LEAK';

export interface DoctorIssue {
  code: DoctorIssueCode;
  message: string;
  file: string;
  relationship: string;
  reason: string;
  suggestion: string;
}

export interface DoctorReport {
  healthy: boolean;
  issues: DoctorIssue[];
}

export function analyzeArchitecture(root = process.cwd()): DoctorReport {
  const discovery = discoverFeatures(root);
  const issues: DoctorIssue[] = discovery.malformed.map((entry) => ({
    code: 'INVALID_FEATURE_SHAPE',
    message: `Feature entry "${entry.name}" is malformed: ${entry.reason}.`,
    file: entry.directory,
    relationship: `${entry.name} feature entry`,
    reason: entry.reason,
    suggestion: 'Create a lowercase feature directory with a public index.ts file.',
  }));

  for (const violation of detectCrossFeatureInternalImports(root)) {
    issues.push({
      code: violation.code,
      message: violation.message,
      file: violation.sourceFile,
      relationship: `${violation.sourceFeature} -> ${violation.targetFeature}`,
      reason: 'Features may communicate only through the target feature public index.',
      suggestion: violation.suggestion,
    });
  }

  for (const cycle of detectFeatureDependencyCycles(root)) {
    issues.push({
      code: 'CIRCULAR_FEATURE_DEPENDENCY',
      message: `Circular feature dependency: ${cycle.path.join(' -> ')}.`,
      file: `src/features/${cycle.path[0]}/index.ts`,
      relationship: cycle.path.join(' -> '),
      reason: 'A dependency cycle makes feature ownership and loading order ambiguous.',
      suggestion: 'Remove one dependency edge or move the shared capability into a lower-level feature.',
    });
  }

  for (const leak of detectServerClientLeaks(root)) {
    issues.push({
      code: leak.code,
      message: `${leak.reason}: ${leak.importSpecifier}.`,
      file: leak.sourceFile,
      relationship: `${leak.feature} web -> ${leak.importSpecifier}`,
      reason: leak.reason,
      suggestion: leak.suggestion,
    });
  }

  issues.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.file.localeCompare(right.file) ||
      left.message.localeCompare(right.message),
  );
  return { healthy: issues.length === 0, issues };
}
