import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { discoverFeatures } from './discover-features';
import type { FeatureBoundary } from './discover-import-evidence';

export type BoundaryExportKind = 'local' | 'named-reexport' | 'default' | 'export-all';
export type BoundaryExportPrecision = 'symbol' | 'module';

export interface BoundaryExportEvidence {
  feature: string;
  boundary: FeatureBoundary;
  boundaryFile: string;
  exportedName?: string;
  kind: BoundaryExportKind;
  precision: BoundaryExportPrecision;
  sourceSpecifier?: string;
  sourceSymbol?: string;
  typeOnly: boolean;
}

export interface BoundaryExportEvidenceByBoundary {
  public: BoundaryExportEvidence[];
  web: BoundaryExportEvidence[];
}

interface ParsedBoundaryExport {
  exportedName?: string;
  kind: BoundaryExportKind;
  precision: BoundaryExportPrecision;
  sourceSpecifier?: string;
  sourceSymbol?: string;
  typeOnly: boolean;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

function declarationIsTypeOnly(statement: ts.Statement): boolean {
  return ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }
  return name.elements.flatMap((element) => (ts.isBindingElement(element) ? bindingNames(element.name) : []));
}

function collectParsedBoundaryExports(file: string): ParsedBoundaryExport[] {
  const sourceFile = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const exports: ParsedBoundaryExport[] = [];

  const add = (value: ParsedBoundaryExport): void => {
    exports.push(value);
  };

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const exportedName of bindingNames(declaration.name)) {
          add({ kind: 'local', precision: 'symbol', exportedName, typeOnly: false });
        }
      }
      continue;
    }

    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    ) {
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        add({
          kind: 'default',
          precision: 'symbol',
          exportedName: 'default',
          typeOnly: declarationIsTypeOnly(statement),
        });
      } else if (statement.name) {
        add({
          kind: 'local',
          precision: 'symbol',
          exportedName: statement.name.text,
          typeOnly: declarationIsTypeOnly(statement),
        });
      }
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      const sourceSpecifier =
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined;
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const value: ParsedBoundaryExport = {
            kind:
              sourceSpecifier === undefined
                ? element.name.text === 'default'
                  ? 'default'
                  : 'local'
                : 'named-reexport',
            precision: 'symbol',
            exportedName: element.name.text,
            typeOnly: statement.isTypeOnly || element.isTypeOnly,
          };
          if (sourceSpecifier !== undefined) {
            value.sourceSpecifier = sourceSpecifier;
            value.sourceSymbol = element.propertyName?.text ?? element.name.text;
          }
          add(value);
        }
      } else if (sourceSpecifier !== undefined) {
        add({
          kind: 'export-all',
          precision: 'module',
          sourceSpecifier,
          typeOnly: statement.isTypeOnly,
        });
      }
      continue;
    }

    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      add({ kind: 'default', precision: 'symbol', exportedName: 'default', typeOnly: false });
    }
  }

  return exports;
}

export function discoverExportedNames(file: string): string[] {
  return [
    ...new Set(
      collectParsedBoundaryExports(file)
        .filter((value) => value.precision === 'symbol' && value.exportedName !== undefined)
        .map((value) => value.exportedName as string),
    ),
  ].sort();
}

export function boundaryExportNames(evidence: BoundaryExportEvidence[]): string[] {
  return [
    ...new Set(
      evidence
        .filter((value) => value.precision === 'symbol' && value.exportedName !== undefined)
        .map((value) => value.exportedName as string),
    ),
  ].sort();
}

export function compareBoundaryExportEvidence(left: BoundaryExportEvidence, right: BoundaryExportEvidence): number {
  return (
    left.feature.localeCompare(right.feature) ||
    left.boundary.localeCompare(right.boundary) ||
    left.boundaryFile.localeCompare(right.boundaryFile) ||
    (left.exportedName ?? '').localeCompare(right.exportedName ?? '') ||
    left.kind.localeCompare(right.kind) ||
    left.precision.localeCompare(right.precision) ||
    (left.sourceSpecifier ?? '').localeCompare(right.sourceSpecifier ?? '') ||
    (left.sourceSymbol ?? '').localeCompare(right.sourceSymbol ?? '') ||
    Number(left.typeOnly) - Number(right.typeOnly)
  );
}

function canonicalBoundaryFile(featureDirectory: string, boundary: FeatureBoundary): string {
  return path.resolve(featureDirectory, boundary === 'public' ? 'index.ts' : 'web/index.ts');
}

function relativePath(root: string, file: string): string {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

export function discoverBoundaryExportEvidence(root = process.cwd()): BoundaryExportEvidence[] {
  const resolvedRoot = path.resolve(root);
  const evidence: BoundaryExportEvidence[] = [];
  const discovery = discoverFeatures(resolvedRoot);

  for (const feature of [...discovery.features].sort((left, right) => left.name.localeCompare(right.name))) {
    const boundaries: FeatureBoundary[] = ['public'];
    const webFile = canonicalBoundaryFile(path.resolve(resolvedRoot, feature.directory), 'web');
    if (existsSync(webFile)) {
      boundaries.push('web');
    }

    for (const boundary of boundaries) {
      const boundaryFile = canonicalBoundaryFile(path.resolve(resolvedRoot, feature.directory), boundary);
      let parsed: ParsedBoundaryExport[];
      try {
        parsed = collectParsedBoundaryExports(boundaryFile);
      } catch {
        continue;
      }

      for (const value of parsed) {
        const current: BoundaryExportEvidence = {
          feature: feature.name,
          boundary,
          boundaryFile: relativePath(resolvedRoot, boundaryFile),
          kind: value.kind,
          precision: value.precision,
          typeOnly: value.typeOnly,
        };
        if (value.exportedName !== undefined) current.exportedName = value.exportedName;
        if (value.sourceSpecifier !== undefined) current.sourceSpecifier = value.sourceSpecifier;
        if (value.sourceSymbol !== undefined) current.sourceSymbol = value.sourceSymbol;
        evidence.push(current);
      }
    }
  }

  return evidence.sort(compareBoundaryExportEvidence);
}

export function boundaryExportsForFeature(
  evidence: BoundaryExportEvidence[],
  feature: string,
): BoundaryExportEvidenceByBoundary {
  return {
    public: evidence
      .filter((value) => value.feature === feature && value.boundary === 'public')
      .map((value) => ({ ...value }))
      .sort(compareBoundaryExportEvidence),
    web: evidence
      .filter((value) => value.feature === feature && value.boundary === 'web')
      .map((value) => ({ ...value }))
      .sort(compareBoundaryExportEvidence),
  };
}

export function directlyReexportedContractSymbol(evidence: BoundaryExportEvidence): string | undefined {
  if (
    evidence.kind !== 'named-reexport' ||
    evidence.precision !== 'symbol' ||
    evidence.sourceSpecifier === undefined ||
    evidence.sourceSymbol === undefined ||
    !evidence.sourceSpecifier.startsWith('.')
  ) {
    return undefined;
  }

  const boundaryFile = evidence.boundaryFile.replaceAll('\\', '/');
  const sourceFile = path.posix.normalize(path.posix.join(path.posix.dirname(boundaryFile), evidence.sourceSpecifier));
  const contractFile = `src/features/${evidence.feature}/contract`;
  if (sourceFile !== contractFile && sourceFile !== `${contractFile}.ts`) {
    return undefined;
  }
  return evidence.sourceSymbol;
}
