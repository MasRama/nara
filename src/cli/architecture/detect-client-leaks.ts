import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { discoverFeatures } from './discover-features';

export interface ServerClientLeak {
  code: 'SERVER_CLIENT_LEAK';
  feature: string;
  sourceFile: string;
  importSpecifier: string;
  reason: string;
  suggestion: string;
}

interface ClientImport {
  specifier: string;
  typeOnly: boolean;
}

function collectImports(file: string): ClientImport[] {
  const sourceFile = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports: ClientImport[] = [];

  function addImport(moduleSpecifier: ts.StringLiteral, typeOnly: boolean): void {
    imports.push({ specifier: moduleSpecifier.text, typeOnly });
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      addImport(node.moduleSpecifier, node.importClause?.isTypeOnly ?? false);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      addImport(node.moduleSpecifier, node.isTypeOnly);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      if (ts.isStringLiteral(node.moduleReference.expression)) {
        addImport(node.moduleReference.expression, false);
      }
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      const expression = node.expression;
      const isRequire = ts.isIdentifier(expression) && expression.text === 'require';
      const isDynamicImport = expression.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) {
        addImport(node.arguments[0], false);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

function resolvesInsideServer(specifier: string, file: string, root: string): boolean {
  const normalized = specifier.replaceAll('\\', '/');
  if (
    normalized.startsWith('@/features/') ||
    normalized.startsWith('@features/') ||
    normalized.startsWith('src/features/')
  ) {
    const featurePath = normalized.replace(/^@\/?features\//, '').replace(/^src\/features\//, '');
    return featurePath.split('/').includes('server');
  }
  if (normalized.startsWith('.') || normalized.startsWith('/')) {
    const resolved = path.resolve(path.dirname(file), specifier);
    const relative = path.relative(path.resolve(root, 'src', 'features'), resolved);
    return !relative.startsWith('..') && relative.split(path.sep).includes('server');
  }
  return false;
}

function sharedServerModule(specifier: string, file: string, root: string): string | undefined {
  const normalized = specifier.replaceAll('\\', '/');
  const sharedPath = normalized.match(/^(?:@\/|@)?shared\/(database|logging|config)(?:\/|$)/)?.[1];
  if (sharedPath) {
    return `shared/${sharedPath}`;
  }
  if (normalized.startsWith('src/shared/')) {
    const sharedPath = normalized.slice('src/shared/'.length).split('/')[0];
    if (['database', 'logging', 'config'].includes(sharedPath)) {
      return `shared/${sharedPath}`;
    }
  }
  if (normalized.startsWith('.') || normalized.startsWith('/')) {
    const resolved = path.resolve(path.dirname(file), specifier);
    const relative = path.relative(path.resolve(root, 'src', 'shared'), resolved);
    const sharedPath = relative.split(path.sep)[0];
    if (!relative.startsWith('..') && ['database', 'logging', 'config'].includes(sharedPath)) {
      return `shared/${sharedPath}`;
    }
  }
  return undefined;
}

function builtinServerModule(specifier: string): boolean {
  return specifier.startsWith('node:') || ['better-sqlite3', 'pino', 'pino-roll', '@hono/node-server'].includes(specifier);
}

export function detectServerClientLeaks(root = process.cwd()): ServerClientLeak[] {
  const discovery = discoverFeatures(root);
  const leaks: ServerClientLeak[] = [];

  for (const feature of discovery.features) {
    for (const relativeFile of feature.files.filter(
      (file) => file.startsWith(`web${path.sep}`) && /\.(?:cts|mts|ts|tsx)$/.test(file),
    )) {
      const absoluteFile = path.resolve(root, feature.directory, relativeFile);
      let imports: ClientImport[];
      try {
        imports = collectImports(absoluteFile);
      } catch {
        continue;
      }

      for (const imported of imports) {
        const sharedModule = sharedServerModule(imported.specifier, absoluteFile, root);
        const reason = resolvesInsideServer(imported.specifier, absoluteFile, root)
          ? 'client code imports a feature server module'
          : sharedModule
            ? `client code imports server-only ${sharedModule}`
            : builtinServerModule(imported.specifier)
              ? 'client code imports a server-only runtime dependency'
              : undefined;
        if (!reason || (imported.typeOnly && !sharedModule && !builtinServerModule(imported.specifier))) {
          continue;
        }

        leaks.push({
          code: 'SERVER_CLIENT_LEAK',
          feature: feature.name,
          sourceFile: path.relative(root, absoluteFile),
          importSpecifier: imported.specifier,
          reason,
          suggestion: 'Move server-only code under server/ and expose client-safe types through contract.ts.',
        });
      }
    }
  }

  return leaks.sort(
    (left, right) =>
      left.feature.localeCompare(right.feature) ||
      left.sourceFile.localeCompare(right.sourceFile) ||
      left.importSpecifier.localeCompare(right.importSpecifier),
  );
}
