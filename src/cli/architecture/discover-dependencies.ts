import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { discoverFeatures, type DiscoveredFeature, type FeatureDiscovery } from './discover-features';

export interface FeatureDependency {
  from: string;
  to: string;
  imports: string[];
  sourceFiles: string[];
  usesInternalPath: boolean;
}

export interface DependencyDiscovery extends FeatureDiscovery {
  dependencies: FeatureDependency[];
}

interface FeatureReference {
  name: string;
  usesInternalPath: boolean;
}

interface ModuleImport {
  specifier: string;
  file: string;
}

function collectModuleImports(file: string): ModuleImport[] {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
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

  const usesInternalPath = pathSuffix.length > 0 && !(pathSuffix.length === 1 && pathSuffix[0] === 'index');
  return { name: featurePath, usesInternalPath };
}

function featureFiles(feature: DiscoveredFeature, root: string): string[] {
  return feature.files
    .filter((file) => /\.(?:cts|mts|ts|tsx)$/.test(file))
    .map((file) => path.resolve(root, feature.directory, file));
}

export function discoverFeatureDependencies(root = process.cwd()): DependencyDiscovery {
  const discovery = discoverFeatures(root);
  const edges = new Map<string, FeatureDependency>();
  const knownFeatures = new Set(discovery.features.map((feature) => feature.name));

  for (const feature of discovery.features) {
    for (const file of featureFiles(feature, root)) {
      let imports: ModuleImport[];
      try {
        imports = collectModuleImports(file);
      } catch {
        continue;
      }

      for (const imported of imports) {
        const reference = featureReferenceFromSpecifier(imported.specifier, file, root);
        if (!reference || reference.name === feature.name || !knownFeatures.has(reference.name)) {
          continue;
        }

        const key = `${feature.name}\0${reference.name}`;
        const dependency = edges.get(key) ?? {
          from: feature.name,
          to: reference.name,
          imports: [],
          sourceFiles: [],
          usesInternalPath: false,
        };
        if (!dependency.imports.includes(imported.specifier)) {
          dependency.imports.push(imported.specifier);
        }
        const sourceFile = path.relative(root, imported.file);
        if (!dependency.sourceFiles.includes(sourceFile)) {
          dependency.sourceFiles.push(sourceFile);
        }
        dependency.usesInternalPath ||= reference.usesInternalPath;
        edges.set(key, dependency);
      }
    }
  }

  const dependencies = [...edges.values()].sort((left, right) =>
    left.from.localeCompare(right.from) || left.to.localeCompare(right.to),
  );
  for (const dependency of dependencies) {
    dependency.imports.sort();
    dependency.sourceFiles.sort();
  }

  return { ...discovery, dependencies };
}
