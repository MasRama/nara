import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { discoverFeatureDependencies } from './discover-dependencies';

export interface FeatureInspection {
  name: string;
  path: string;
  publicExports: string[];
  dependencies: string[];
  dependents: string[];
  serverEntrypoints: string[];
  webEntrypoints: string[];
  contracts: string[];
  tests: string[];
}

export type InspectFeatureResult =
  | { ok: true; feature: FeatureInspection }
  | { ok: false; message: string };

function exportedNames(file: string): string[] {
  const sourceFile = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const names: string[] = [];

  function add(name: string): void {
    if (!names.includes(name)) {
      names.push(name);
    }
  }

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          add(declaration.name.text);
        }
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) &&
      statement.name
    ) {
      add(statement.name.text);
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          add(element.name.text);
        }
      } else if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
        add(`* from ${statement.moduleSpecifier.text}`);
      }
    } else if (ts.isExportAssignment(statement)) {
      add('default');
    }
  }

  return names.sort();
}

function normalizedFiles(files: string[], directory: string): string[] {
  return files
    .filter((file) => file.startsWith(`${directory}${path.sep}`))
    .map((file) => file.replaceAll(path.sep, '/'))
    .sort();
}

export function inspectFeature(name: string, root = process.cwd()): InspectFeatureResult {
  const discovery = discoverFeatureDependencies(root);
  const feature = discovery.features.find((candidate) => candidate.name === name);
  if (!feature) {
    const available = discovery.features.map((candidate) => candidate.name).join(', ') || 'none';
    return {
      ok: false,
      message: `Unknown feature "${name}". Available features: ${available}.`,
    };
  }

  const indexFile = path.resolve(root, feature.directory, 'index.ts');
  const dependencies = discovery.dependencies
    .filter((dependency) => dependency.from === name)
    .map((dependency) => dependency.to)
    .sort();
  const dependents = discovery.dependencies
    .filter((dependency) => dependency.to === name)
    .map((dependency) => dependency.from)
    .sort();

  return {
    ok: true,
    feature: {
      name: feature.name,
      path: feature.directory,
      publicExports: exportedNames(indexFile),
      dependencies,
      dependents,
      serverEntrypoints: normalizedFiles(feature.files, 'server'),
      webEntrypoints: normalizedFiles(feature.files, 'web'),
      contracts: feature.hasContract
        ? exportedNames(path.resolve(root, feature.directory, 'contract.ts'))
        : [],
      tests: normalizedFiles(feature.files, 'tests'),
    },
  };
}
