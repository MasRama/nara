import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { AssemblyTemplates } from './assembly';

/**
 * The `src/shared/` modules every Nara application carries, so official
 * Features and their assembly templates may import them. Everything else
 * under `src/shared/` (logging, app tuning) belongs to the reference app.
 * The set is checked against what a package actually imports, never
 * declared per package.
 */
export const GUARANTEED_SHARED_MODULES: ReadonlySet<string> = new Set([
  'config',
  'database',
  'realtime',
  'security',
  'storage',
]);

export interface SharedModuleUse {
  /** Imported path below `src/shared/`, such as `realtime/browser`. */
  entry: string;
  /** Top-level module, such as `realtime`. */
  module: string;
  /** Package file or assembly template that imports it. */
  importer: string;
}

/** Where a specifier lands below `src/shared/`, from a file installed at `installedFile`. */
function sharedEntry(specifier: string, installedFile: string): string | undefined {
  let target: string;
  if (specifier.startsWith('@/')) target = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith('@shared/')) target = `src/shared/${specifier.slice('@shared/'.length)}`;
  else if (specifier.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(installedFile), specifier));
  else return undefined;
  if (!target.startsWith('src/shared/')) return undefined;
  const entry = target.slice('src/shared/'.length).replace(/\/index$/, '').replace(/\.ts$/, '');
  return entry || undefined;
}

function moduleSpecifiers(source: string, file: string): string[] {
  const units = file.endsWith('.vue')
    ? [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1])
    : [source];
  const found: string[] = [];
  for (const unit of units) {
    const sourceFile = ts.createSourceFile('scan.ts', unit, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        found.push(node.moduleSpecifier.text);
      } else if (
        ts.isCallExpression(node)
        && node.arguments.length === 1
        && ts.isStringLiteral(node.arguments[0])
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        found.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return found;
}

/**
 * Every `src/shared/` entry an official package reaches, resolved from where
 * its files and templates land once installed (`src/features/<feature>/` and
 * `src/app/bindings/`). Tests count too: they are installed with the source.
 */
export function sharedModuleUses(
  feature: string,
  sourceFiles: ReadonlyMap<string, Buffer | string>,
  templates: AssemblyTemplates,
): SharedModuleUse[] {
  const units: Array<{ importer: string; installedFile: string; content: string }> = [];
  for (const [relative, bytes] of sourceFiles) {
    units.push({
      importer: relative,
      installedFile: `src/features/${feature}/${relative}`,
      content: typeof bytes === 'string' ? bytes : bytes.toString('utf8'),
    });
  }
  if (templates.server !== undefined) {
    units.push({ importer: '.nara/assembly/server.ts', installedFile: `src/app/bindings/${feature}.server.ts`, content: templates.server });
  }
  if (templates.web !== undefined) {
    units.push({ importer: '.nara/assembly/web.ts', installedFile: `src/app/bindings/${feature}.web.ts`, content: templates.web });
  }

  const uses: SharedModuleUse[] = [];
  const seen = new Set<string>();
  for (const unit of units) {
    for (const specifier of moduleSpecifiers(unit.content, unit.importer)) {
      const entry = sharedEntry(specifier, unit.installedFile);
      if (entry === undefined || seen.has(`${unit.importer}\0${entry}`)) continue;
      seen.add(`${unit.importer}\0${entry}`);
      uses.push({ entry, module: entry.split('/')[0], importer: unit.importer });
    }
  }
  const key = (use: SharedModuleUse) => `${use.importer}\0${use.entry}`;
  return uses.sort((left, right) => (key(left) < key(right) ? -1 : key(left) > key(right) ? 1 : 0));
}

/** An official package may reach only guaranteed modules; anything else is a catalog defect. */
export function unguaranteedSharedUses(uses: readonly SharedModuleUse[]): SharedModuleUse[] {
  return uses.filter((use) => !GUARANTEED_SHARED_MODULES.has(use.module));
}

function entryExists(root: string, entry: string): boolean {
  const base = path.resolve(root, 'src', 'shared', ...entry.split('/'));
  const isFile = (file: string) => existsSync(file) && statSync(file).isFile();
  return isFile(`${base}.ts`) || isFile(path.join(base, 'index.ts'));
}

/**
 * Fail closed before anything is written when an official package reaches a
 * `src/shared/` module outside the guaranteed set, or one the application
 * no longer provides. `action` names the command in the message.
 */
export function checkSharedSubstrate(
  root: string,
  feature: string,
  uses: readonly SharedModuleUse[],
  action: 'add' | 'evolve',
): string | undefined {
  const verb = action === 'add' ? 'nothing was installed' : 'no files were changed';
  const unguaranteed = unguaranteedSharedUses(uses);
  if (unguaranteed.length > 0) {
    const listed = unguaranteed.map((use) => `${use.importer} → src/shared/${use.entry}`).join(', ');
    return (
      `Cannot ${action} "${feature}": the official source imports src/shared modules Nara does not guarantee (${listed}). `
      + `Official Features may rely only on src/shared/{${[...GUARANTEED_SHARED_MODULES].join(',')}}; ${verb}.`
    );
  }
  const missing = [...new Set(uses.filter((use) => !entryExists(root, use.entry)).map((use) => use.entry))].sort();
  if (missing.length > 0) {
    return (
      `Cannot ${action} "${feature}": it needs ${missing.map((entry) => `src/shared/${entry}`).join(', ')}, `
      + `which this application does not provide. Restore ${missing.length === 1 ? 'it' : 'them'} from the Nara reference application first; ${verb}.`
    );
  }
  return undefined;
}
