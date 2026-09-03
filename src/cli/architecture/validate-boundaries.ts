import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { discoverFeatureDependencies } from './discover-dependencies';
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

interface ModuleImport {
  specifier: string;
  file: string;
}

interface FeatureReference {
  name: string;
  usesInternalPath: boolean;
}

const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?|vue)$/;
const INDEX_PATH_PATTERN = /^index(?:\.[cm]?[jt]sx?)?$/;
const BROWSER_PUBLIC_PATH_PATTERN = /^web(?:\/index(?:\.[cm]?[jt]sx?)?)?$/;

function sourceForParsing(file: string): string {
  const source = readFileSync(file, 'utf8');
  if (!file.endsWith('.vue')) {
    return source;
  }

  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join('\n');
}

function collectModuleImports(file: string): ModuleImport[] {
  const sourceFile = ts.createSourceFile(file, sourceForParsing(file), ts.ScriptTarget.Latest, true);
  const imports: ModuleImport[] = [];

  function addImport(moduleSpecifier: ts.StringLiteral): void {
    imports.push({ specifier: moduleSpecifier.text, file });
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      addImport(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      addImport(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      if (ts.isStringLiteral(node.moduleReference.expression)) {
        addImport(node.moduleReference.expression);
      }
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      const expression = node.expression;
      const isRequire = ts.isIdentifier(expression) && expression.text === 'require';
      const isDynamicImport = expression.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) {
        addImport(node.arguments[0]);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

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

function featurePathSuffix(specifier: string, targetFeature: string): string | undefined {
  const normalized = specifier.replaceAll('\\', '/');
  const marker = `/${targetFeature}`;
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) {
    return undefined;
  }

  return normalized.slice(markerIndex + marker.length).replace(/^\/+/, '');
}

function isPublicFeaturePath(suffix: string): boolean {
  return suffix.length === 0 || INDEX_PATH_PATTERN.test(suffix) || BROWSER_PUBLIC_PATH_PATTERN.test(suffix);
}

function featureReferenceFromSpecifier(
  specifier: string,
  file: string,
  root: string,
): FeatureReference | undefined {
  const featureRoot = path.resolve(root, 'src', 'features');
  let featurePath: string | undefined;
  let pathSuffix: string[] = [];

  if (specifier.startsWith('@/features/')) {
    const segments = specifier.slice('@/features/'.length).split('/');
    featurePath = segments[0];
    pathSuffix = segments.slice(1);
  } else if (specifier.startsWith('@features/')) {
    const segments = specifier.slice('@features/'.length).split('/');
    featurePath = segments[0];
    pathSuffix = segments.slice(1);
  } else if (specifier.startsWith('src/features/')) {
    const segments = specifier.slice('src/features/'.length).split('/');
    featurePath = segments[0];
    pathSuffix = segments.slice(1);
  } else if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const resolvedPath = path.resolve(path.dirname(file), specifier);
    const relativePath = path.relative(featureRoot, resolvedPath);
    const segments = relativePath.split(path.sep);
    if (segments.length === 0 || segments[0] === '..' || path.isAbsolute(relativePath)) {
      return undefined;
    }
    [featurePath, ...pathSuffix] = segments;
  } else {
    return undefined;
  }

  if (!featurePath) {
    return undefined;
  }

  return {
    name: featurePath,
    usesInternalPath: !isPublicFeaturePath(pathSuffix.join('/')),
  };
}

function usesInternalPath(specifier: string, targetFeature: string): boolean {
  const suffix = featurePathSuffix(specifier, targetFeature);
  return suffix !== undefined && !isPublicFeaturePath(suffix);
}

function browserBoundaryImport(specifier: string, targetFeature: string): boolean {
  const suffix = featurePathSuffix(specifier, targetFeature);
  return suffix === 'web' || (suffix?.startsWith('web/') ?? false);
}

function publicBoundarySuggestion(specifier: string, targetFeature: string): string {
  const boundary = browserBoundaryImport(specifier, targetFeature) ? '/web' : '';
  const interfaceName = boundary ? 'browser-safe public interface' : 'public interface';
  return `Import the ${interfaceName} from "@/features/${targetFeature}${boundary}" instead of "${specifier}".`;
}

export function detectCrossFeatureInternalImports(root = process.cwd()): BoundaryViolation[] {
  const { dependencies } = discoverFeatureDependencies(root);
  const violations: BoundaryViolation[] = [];

  for (const dependency of dependencies) {
    for (const relativeSourceFile of dependency.sourceFiles) {
      const sourceFile = path.resolve(root, relativeSourceFile);
      let imports: ModuleImport[];
      try {
        imports = collectModuleImports(sourceFile);
      } catch {
        continue;
      }

      for (const imported of imports) {
        if (!usesInternalPath(imported.specifier, dependency.to)) {
          continue;
        }

        violations.push({
          code: 'CROSS_FEATURE_INTERNAL_IMPORT',
          boundary: browserBoundaryImport(imported.specifier, dependency.to) ? 'browser' : 'general',
          sourceFeature: dependency.from,
          targetFeature: dependency.to,
          sourceFile: relativeSourceFile,
          importSpecifier: imported.specifier,
          message: `Feature "${dependency.from}" imports internal feature code from "${dependency.to}" in ${relativeSourceFile}.`,
          suggestion: publicBoundarySuggestion(imported.specifier, dependency.to),
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

export function detectApplicationFeatureInternalImports(root = process.cwd()): ApplicationBoundaryViolation[] {
  const knownFeatures = new Set(discoverFeatures(root).features.map((feature) => feature.name));
  const applicationRoot = path.resolve(root, 'src', 'app');
  const violations: ApplicationBoundaryViolation[] = [];

  for (const sourceFile of collectSourceFiles(applicationRoot)) {
    let imports: ModuleImport[];
    try {
      imports = collectModuleImports(sourceFile);
    } catch {
      continue;
    }

    for (const imported of imports) {
      const reference = featureReferenceFromSpecifier(imported.specifier, sourceFile, root);
      if (!reference || !knownFeatures.has(reference.name) || !reference.usesInternalPath) {
        continue;
      }

      violations.push({
        code: 'APPLICATION_FEATURE_INTERNAL_IMPORT',
        targetFeature: reference.name,
        sourceFile: path.relative(root, sourceFile),
        importSpecifier: imported.specifier,
        message: `Application code imports internal feature code from "${reference.name}" in ${path.relative(root, sourceFile)}.`,
        suggestion: publicBoundarySuggestion(imported.specifier, reference.name),
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
