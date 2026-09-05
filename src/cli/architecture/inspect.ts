import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { discoverFeatureDependencies } from './discover-dependencies';
import { discoverFeatureIntegrations, type FeatureIntegrationFacts } from './discover-integrations';
import type { FeatureImportEvidence } from './discover-import-evidence';

export interface FeatureInspection {
  name: string;
  path: string;
  publicExports: string[];
  webPublicExports: string[];
  dependencies: string[];
  dependents: string[];
  serverEntrypoints: string[];
  webEntrypoints: string[];
  contracts: string[];
  tests: string[];
  consumerEvidence: FeatureImportEvidence[];
  integrations: FeatureIntegrationFacts;
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
  const webIndexFile = path.resolve(root, feature.directory, 'web', 'index.ts');
  const dependencies = discovery.dependencies
    .filter((dependency) => dependency.from === name)
    .map((dependency) => dependency.to)
    .sort();
  const dependents = discovery.dependencies
    .filter((dependency) => dependency.to === name)
    .map((dependency) => dependency.from)
    .sort();
  const consumerEvidence = discovery.importEvidence
    .filter(
      (evidence) =>
        evidence.to === name && evidence.precision === 'symbol' && evidence.boundary !== undefined,
    )
    .map((evidence) => ({ ...evidence }));
  const integrations = discoverFeatureIntegrations(root)[name] ?? {
    applicationImports: [],
    serverRoutes: [],
    webRoutes: [],
  };

  return {
    ok: true,
    feature: {
      name: feature.name,
      path: feature.directory,
      publicExports: exportedNames(indexFile),
      webPublicExports: existsSync(webIndexFile) ? exportedNames(webIndexFile) : [],
      dependencies,
      dependents,
      serverEntrypoints: normalizedFiles(feature.files, 'server'),
      webEntrypoints: normalizedFiles(feature.files, 'web'),
      contracts: feature.hasContract
        ? exportedNames(path.resolve(root, feature.directory, 'contract.ts'))
        : [],
      tests: normalizedFiles(feature.files, 'tests'),
      consumerEvidence,
      integrations: {
        applicationImports: integrations.applicationImports.map((fact) => ({
          ...fact,
          symbols: [...fact.symbols],
        })),
        serverRoutes: integrations.serverRoutes.map((route) => ({ ...route })),
        webRoutes: integrations.webRoutes.map((route) => ({ ...route })),
      },
    },
  };
}
