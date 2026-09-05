import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { discoverFeatures, type DiscoveredFeature } from './discover-features';

export type FeatureBoundary = 'public' | 'web';

export interface FeatureReference {
  name: string;
  usesInternalPath: boolean;
  boundary: FeatureBoundary | undefined;
}

export type FeatureImportKind =
  | 'named-import'
  | 'default-import'
  | 'namespace-import'
  | 'side-effect-import'
  | 'named-reexport'
  | 'export-all'
  | 'require'
  | 'dynamic-import';

export interface FeatureImportEvidence {
  from: string;
  to: string;
  sourceFile: string;
  specifier: string;
  boundary?: FeatureBoundary;
  usesInternalPath: boolean;
  kind: FeatureImportKind;
  precision: 'symbol' | 'module';
  importedSymbol?: string;
  localName?: string;
  exportedName?: string;
  typeOnly: boolean;
}

interface ParsedModuleImport {
  specifier: string;
  kind: FeatureImportKind;
  precision: 'symbol' | 'module';
  importedSymbol?: string;
  localName?: string;
  exportedName?: string;
  typeOnly: boolean;
}

const INDEX_PATH_PATTERN = /^index(?:\.[cm]?[jt]sx?)?$/;
const BROWSER_PUBLIC_PATH_PATTERN = /^web(?:\/index(?:\.[cm]?[jt]sx?)?)?$/;

function featureBoundary(suffix: string): FeatureBoundary | undefined {
  if (suffix.length === 0 || INDEX_PATH_PATTERN.test(suffix)) {
    return 'public';
  }
  if (BROWSER_PUBLIC_PATH_PATTERN.test(suffix)) {
    return 'web';
  }
  return undefined;
}

function isPublicFeaturePath(suffix: string): boolean {
  return featureBoundary(suffix) !== undefined;
}

export function featurePathSuffix(specifier: string, targetFeature: string): string | undefined {
  const normalized = specifier.replaceAll('\\', '/');
  const marker = `/${targetFeature}`;
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) {
    return undefined;
  }

  return normalized.slice(markerIndex + marker.length).replace(/^\/+/, '');
}

export function isBrowserFeatureSpecifier(specifier: string, targetFeature: string): boolean {
  const suffix = featurePathSuffix(specifier, targetFeature);
  return suffix === 'web' || (suffix?.startsWith('web/') ?? false);
}

export function featureReferenceFromSpecifier(
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

  const normalizedSuffix = pathSuffix.join('/');
  return {
    name: featurePath,
    usesInternalPath: !isPublicFeaturePath(normalizedSuffix),
    boundary: featureBoundary(normalizedSuffix),
  };
}

function sourceForParsing(file: string): string {
  const source = readFileSync(file, 'utf8');
  if (!file.endsWith('.vue')) {
    return source;
  }

  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join('\n');
}

function importedName(element: ts.ImportSpecifier): string {
  return element.propertyName?.text ?? element.name.text;
}

function addParsedImport(imports: ParsedModuleImport[], value: ParsedModuleImport): void {
  imports.push(value);
}

function collectParsedImports(file: string): ParsedModuleImport[] {
  const sourceFile = ts.createSourceFile(file, sourceForParsing(file), ts.ScriptTarget.Latest, true);
  const imports: ParsedModuleImport[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (!clause) {
        addParsedImport(imports, {
          specifier: node.moduleSpecifier.text,
          kind: 'side-effect-import',
          precision: 'module',
          typeOnly: false,
        });
      } else {
        if (clause.name) {
          addParsedImport(imports, {
            specifier: node.moduleSpecifier.text,
            kind: 'default-import',
            precision: 'symbol',
            importedSymbol: 'default',
            localName: clause.name.text,
            typeOnly: clause.isTypeOnly,
          });
        }
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            addParsedImport(imports, {
              specifier: node.moduleSpecifier.text,
              kind: 'named-import',
              precision: 'symbol',
              importedSymbol: importedName(element),
              localName: element.name.text,
              typeOnly: clause.isTypeOnly || element.isTypeOnly,
            });
          }
        } else if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
          addParsedImport(imports, {
            specifier: node.moduleSpecifier.text,
            kind: 'namespace-import',
            precision: 'module',
            localName: clause.namedBindings.name.text,
            typeOnly: clause.isTypeOnly,
          });
        }
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          addParsedImport(imports, {
            specifier: node.moduleSpecifier.text,
            kind: 'named-reexport',
            precision: 'symbol',
            importedSymbol: element.propertyName?.text ?? element.name.text,
            exportedName: element.name.text,
            typeOnly: node.isTypeOnly || element.isTypeOnly,
          });
        }
      } else {
        addParsedImport(imports, {
          specifier: node.moduleSpecifier.text,
          kind: 'export-all',
          precision: 'module',
          typeOnly: node.isTypeOnly,
        });
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      addParsedImport(imports, {
        specifier: node.moduleReference.expression.text,
        kind: 'require',
        precision: 'module',
        typeOnly: node.isTypeOnly,
      });
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && expression.text === 'require') {
        addParsedImport(imports, {
          specifier: node.arguments[0].text,
          kind: 'require',
          precision: 'module',
          typeOnly: false,
        });
      } else if (expression.kind === ts.SyntaxKind.ImportKeyword) {
        addParsedImport(imports, {
          specifier: node.arguments[0].text,
          kind: 'dynamic-import',
          precision: 'module',
          typeOnly: false,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

export function collectStaticModuleSpecifiers(file: string): string[] {
  return collectParsedImports(file).map(({ specifier }) => specifier);
}

function featureFiles(feature: DiscoveredFeature, root: string): string[] {
  return feature.files
    .filter((file) => /\.(?:cts|mts|ts|tsx|vue)$/.test(file))
    .map((file) => path.resolve(root, feature.directory, file))
    .sort();
}

function compareEvidence(left: FeatureImportEvidence, right: FeatureImportEvidence): number {
  return (
    left.from.localeCompare(right.from) ||
    left.to.localeCompare(right.to) ||
    (left.boundary ?? '').localeCompare(right.boundary ?? '') ||
    left.sourceFile.localeCompare(right.sourceFile) ||
    left.specifier.localeCompare(right.specifier) ||
    left.kind.localeCompare(right.kind) ||
    left.precision.localeCompare(right.precision) ||
    (left.importedSymbol ?? '').localeCompare(right.importedSymbol ?? '') ||
    (left.localName ?? '').localeCompare(right.localName ?? '') ||
    (left.exportedName ?? '').localeCompare(right.exportedName ?? '') ||
    Number(left.typeOnly) - Number(right.typeOnly)
  );
}

export function discoverFeatureImportEvidence(root = process.cwd()): FeatureImportEvidence[] {
  const resolvedRoot = path.resolve(root);
  const discovery = discoverFeatures(resolvedRoot);
  const knownFeatures = new Set(discovery.features.map((feature) => feature.name));
  const evidence: FeatureImportEvidence[] = [];

  for (const feature of [...discovery.features].sort((left, right) => left.name.localeCompare(right.name))) {
    for (const file of featureFiles(feature, resolvedRoot)) {
      let imports: ParsedModuleImport[];
      try {
        imports = collectParsedImports(file);
      } catch {
        continue;
      }

      for (const imported of imports) {
        const reference = featureReferenceFromSpecifier(imported.specifier, file, resolvedRoot);
        if (!reference || reference.name === feature.name || !knownFeatures.has(reference.name)) {
          continue;
        }

        const current: FeatureImportEvidence = {
          from: feature.name,
          to: reference.name,
          sourceFile: path.relative(resolvedRoot, file).replaceAll(path.sep, '/'),
          specifier: imported.specifier,
          usesInternalPath: reference.usesInternalPath,
          kind: imported.kind,
          precision: imported.precision,
          typeOnly: imported.typeOnly,
        };
        if (reference.boundary !== undefined) current.boundary = reference.boundary;
        if (imported.importedSymbol !== undefined) current.importedSymbol = imported.importedSymbol;
        if (imported.localName !== undefined) current.localName = imported.localName;
        if (imported.exportedName !== undefined) current.exportedName = imported.exportedName;
        evidence.push(current);
      }
    }
  }

  return evidence.sort(compareEvidence);
}

export function compareFeatureImportEvidence(left: FeatureImportEvidence, right: FeatureImportEvidence): number {
  return compareEvidence(left, right);
}
