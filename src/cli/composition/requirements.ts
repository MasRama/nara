import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { discoverExportedNames } from '../architecture/discover-boundary-exports';
import { featureNameIsValid } from '../feature-name';
import { serverBindingDestination, webBindingDestination, type AssemblyTemplates } from './assembly';

export const REQUIREMENTS_FILE_NAME = 'requirements.json';

/**
 * Explicit distribution-time requirements for an official Feature.
 *
 * This answers only "what must exist for this distribution artifact to
 * install and run": provider Features the bundled bindings are written
 * against, and npm packages the Feature source needs beyond the
 * guaranteed platform core. It is not architecture truth — feature
 * existence, dependencies, consumers, ownership, and route integration
 * continue to come from source, and architecture readers never consult
 * this file.
 */
export interface FeatureRequirements {
  schemaVersion: 1;
  providers: string[];
  packages: Record<string, string>;
}

export type ReadRequirementsResult =
  | { ok: true; requirements: FeatureRequirements | undefined }
  | { ok: false; error: string };

/**
 * Packages every Nara application already carries. Feature source that
 * imports only these (plus node built-ins, relative paths, and the `@/`
 * application alias) declares no package requirements.
 */
export const GUARANTEED_CORE_PACKAGES: ReadonlySet<string> = new Set([
  '@hono/node-server',
  'hono',
  'vue',
  'vue-router',
]);

const PACKAGE_NAME_PATTERN = /^(@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/i;

export function requirementsFilePath(officialDirectory: string): string {
  return path.join(officialDirectory, '.nara', REQUIREMENTS_FILE_NAME);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readFeatureRequirements(officialDirectory: string): ReadRequirementsResult {
  const file = requirementsFilePath(officialDirectory);
  if (!existsSync(file)) return { ok: true, requirements: undefined };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { ok: false, error: `Requirements at ${file} are not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!isRecord(parsed)) return { ok: false, error: `Requirements at ${file} must be a JSON object.` };
  if (parsed.schemaVersion !== 1) {
    return { ok: false, error: `Requirements at ${file} declare unsupported schemaVersion ${String(parsed.schemaVersion)}; expected 1.` };
  }
  if (!Array.isArray(parsed.providers) || !parsed.providers.every((entry): entry is string => typeof entry === 'string')) {
    return { ok: false, error: `Requirements at ${file} must declare "providers" as an array of feature names.` };
  }
  for (const provider of parsed.providers) {
    if (!featureNameIsValid(provider)) {
      return { ok: false, error: `Requirements at ${file} declare invalid provider name "${provider}".` };
    }
  }
  if (!isRecord(parsed.packages)) {
    return { ok: false, error: `Requirements at ${file} must declare "packages" as an object of name-to-version entries.` };
  }
  const packages: Record<string, string> = {};
  for (const [name, version] of Object.entries(parsed.packages)) {
    if (!PACKAGE_NAME_PATTERN.test(name)) {
      return { ok: false, error: `Requirements at ${file} declare invalid package name "${name}".` };
    }
    if (typeof version !== 'string' || version.trim().length === 0) {
      return { ok: false, error: `Requirements at ${file} declare package "${name}" without a version.` };
    }
    packages[name] = version;
  }
  return { ok: true, requirements: { schemaVersion: 1, providers: [...parsed.providers], packages } };
}

function scriptBlocks(source: string, file: string): string[] {
  if (!file.endsWith('.vue')) return [source];
  const blocks: string[] = [];
  const pattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) blocks.push(match[1]);
  return blocks;
}

function npmPackageOf(specifier: string): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) return undefined;
  if (
    specifier === '@/'
    || specifier.startsWith('@/')
    || specifier.startsWith('@app/')
    || specifier.startsWith('@features/')
    || specifier.startsWith('@shared/')
  ) {
    return undefined;
  }
  if (specifier === 'node' || specifier.startsWith('node/')) return undefined;
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length < 2 || !parts[1]) return undefined;
    return `${parts[0]}/${parts[1]}`;
  }
  const [head] = specifier.split('/');
  return head || undefined;
}

function bareImportsOfUnit(source: string): Set<string> {
  const found = new Set<string>();
  const sourceFile = ts.createSourceFile('scan.ts', source, ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = npmPackageOf(node.moduleSpecifier.text);
      if (name) found.add(name);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = npmPackageOf(node.moduleSpecifier.text);
      if (name) found.add(name);
    } else if (
      ts.isCallExpression(node)
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && ((ts.isIdentifier(node.expression) && (node.expression.text === 'require' || node.expression.text === 'import'))
        || node.expression.kind === ts.SyntaxKind.ImportKeyword)
    ) {
      const name = npmPackageOf(node.arguments[0].text);
      if (name) found.add(name);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

function isTestFile(relativePath: string): boolean {
  const segments = relativePath.split('/');
  return segments.includes('tests') || segments[segments.length - 1].includes('.test.');
}

/**
 * Collect every npm package imported by runtime Feature source and
 * assembly templates. Test files are excluded: test tooling ships with the
 * application template, while requirements cover runtime dependencies.
 * Files that fail to parse contribute nothing; syntax itself is enforced
 * by typecheck and architecture validation elsewhere.
 */
export function collectBareImports(
  sourceFiles: ReadonlyMap<string, Buffer | string>,
  templates: AssemblyTemplates,
): Set<string> {
  const found = new Set<string>();
  const addSource = (file: string, content: string) => {
    for (const unit of scriptBlocks(content, file)) {
      for (const name of bareImportsOfUnit(unit)) found.add(name);
    }
  };
  for (const [relative, bytes] of sourceFiles) {
    if (isTestFile(relative)) continue;
    addSource(relative, typeof bytes === 'string' ? bytes : bytes.toString('utf8'));
  }
  if (templates.server !== undefined) addSource('assembly-server.ts', templates.server);
  if (templates.web !== undefined) addSource('assembly-web.ts', templates.web);
  for (const core of GUARANTEED_CORE_PACKAGES) found.delete(core);
  return found;
}

/**
 * Validate declared requirements against what the distributable source
 * actually imports. Both directions fail: an imported package without a
 * declaration is a hidden prerequisite, and a declared package nothing
 * imports is stale metadata. Deterministic: offending names are sorted.
 */
export function validateRequirementsAgainstSource(
  requirements: FeatureRequirements,
  sourceFiles: ReadonlyMap<string, Buffer | string>,
  templates: AssemblyTemplates,
): string | undefined {
  const imported = [...collectBareImports(sourceFiles, templates)].sort();
  const declared = Object.keys(requirements.packages).sort();
  const missing = imported.filter((name) => !Object.hasOwn(requirements.packages, name));
  if (missing.length > 0) {
    return (
      `Feature requirements declare no npm package for ${missing.map((name) => `"${name}"`).join(', ')}, `
      + 'but Feature source imports them. Declare every non-platform package explicitly; nothing was installed.'
    );
  }
  const stale = declared.filter((name) => !imported.includes(name));
  if (stale.length > 0) {
    return (
      `Feature requirements declare npm ${stale.length === 1 ? 'package' : 'packages'} ${stale.map((name) => `"${name}"`).join(', ')}, `
      + 'but no Feature source imports them. Remove stale declarations; nothing was installed.'
    );
  }
  return undefined;
}

export interface TemplateProviderNeed {
  provider: string;
  boundaryFile: string;
  symbols: string[];
  existenceOnly: boolean;
  templateRole: string;
}

/**
 * Parse one assembly template (or installed binding file, which shares the
 * shape) for imports that name another Feature's public boundary. Templates
 * live in `src/app/bindings/`, so only destination-relative
 * `../../features/<provider>` (or `/web`) specifiers count; every other
 * specifier is ordinary application code, not a provider requirement.
 */
export function templateProviderNeeds(source: string, feature: string, templateRole: string): TemplateProviderNeed[] {
  const sourceFile = ts.createSourceFile('assembly-template.ts', source, ts.ScriptTarget.Latest, true);
  const needs: TemplateProviderNeed[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const match = /^\.\.\/\.\.\/features\/([^/]+?)((?:\/web)?)(?:\/index(?:\.ts)?)?$/.exec(
      statement.moduleSpecifier.text,
    );
    if (!match || match[1] === feature) continue;
    const provider = match[1];
    const boundaryFile = match[2] === '/web' ? `src/features/${provider}/web/index.ts` : `src/features/${provider}/index.ts`;
    const clause = statement.importClause;
    if (!clause || (!clause.name && !clause.namedBindings)) {
      needs.push({ provider, boundaryFile, symbols: [], existenceOnly: true, templateRole });
      continue;
    }
    if (clause.name) {
      needs.push({ provider, boundaryFile, symbols: [], existenceOnly: true, templateRole });
    }
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      needs.push({ provider, boundaryFile, symbols: [], existenceOnly: true, templateRole });
      continue;
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      const symbols = clause.namedBindings.elements.map((element) => element.propertyName?.text ?? element.name.text);
      if (symbols.length > 0) {
        needs.push({ provider, boundaryFile, symbols, existenceOnly: false, templateRole });
      }
    }
  }
  return needs;
}

/**
 * Fail closed when an assembly template statically requires provider
 * Features the target application does not supply. There is no Feature
 * dependency resolver: the application must provide the prerequisite first.
 * Runs before any mutation and before candidate validation.
 *
 * When the official package declares explicit providers, the declared set
 * must match the providers the templates actually import in both
 * directions; otherwise the requirements metadata is stale. Without
 * declared requirements, the template-derived needs are checked directly
 * (older official packages).
 */
export function checkAssemblyPrerequisites(
  root: string,
  feature: string,
  templates: AssemblyTemplates,
  declaredProviders?: string[],
): string | undefined {
  const needs: TemplateProviderNeed[] = [
    ...(templates.server === undefined ? [] : templateProviderNeeds(templates.server, feature, 'server')),
    ...(templates.web === undefined ? [] : templateProviderNeeds(templates.web, feature, 'web')),
  ];
  if (declaredProviders !== undefined) {
    const derived = [...new Set(needs.map((need) => need.provider))].sort();
    const declared = [...new Set(declaredProviders)].sort();
    const undeclared = derived.filter((provider) => !declared.includes(provider));
    if (undeclared.length > 0) {
      return (
        `Cannot add "${feature}": the assembly needs ${undeclared.map((provider) => `"${provider}"`).join(', ')}, `
        + 'but its requirements declare no such provider. Fix the official requirements; nothing was installed.'
      );
    }
    const unused = declared.filter((provider) => !derived.includes(provider));
    if (unused.length > 0) {
      return (
        `Cannot add "${feature}": its requirements declare ${unused.map((provider) => `"${provider}"`).join(', ')} `
        + 'as a provider, but no assembly template uses them. Fix the official requirements; nothing was installed.'
      );
    }
  }
  for (const need of needs) {
    const boundaryPath = path.resolve(root, need.boundaryFile);
    let exported: string[];
    try {
      exported = discoverExportedNames(boundaryPath);
    } catch {
      return (
        `Cannot add "${feature}": it requires an "${need.provider}" provider for the bundled application binding. `
        + `Install/provide the required provider before composing "${feature}"; nothing was installed.`
      );
    }
    if (need.existenceOnly) continue;
    const missing = need.symbols.filter((symbol) => !exported.includes(symbol));
    if (missing.length > 0) {
      return (
        `Cannot add "${feature}": the ${need.templateRole} assembly needs ${missing.map((symbol) => `"${symbol}"`).join(', ')} `
        + `from the "${need.provider}" feature, but ${need.boundaryFile} does not export them. Provide a compatible "${need.provider}" first; nothing was installed.`
      );
    }
  }
  return undefined;
}

/**
 * Report incoming requirements the current application does not satisfy,
 * for `nara evolve`. Evolve reconciles Feature-owned source only: it never
 * touches bindings or package.json, so unsatisfied provider or package
 * requirements surface here as notices for an explicit follow-up instead
 * of silent mutation. Absent bindings are skipped, not reported.
 */
export function checkInstalledRequirements(root: string, feature: string, officialDirectory: string): string[] {
  const read = readFeatureRequirements(officialDirectory);
  if (!read.ok) return [`Official requirements for "${feature}" are invalid: ${read.error}`];
  if (!read.requirements) return [];
  const notices: string[] = [];
  const templates: AssemblyTemplates = {};
  try {
    templates.server = readFileSync(serverBindingDestination(root, feature), 'utf8');
  } catch {
    // Absent binding: nothing to verify against.
  }
  try {
    templates.web = readFileSync(webBindingDestination(root, feature), 'utf8');
  } catch {
    // Absent binding: nothing to verify against.
  }
  if (templates.server !== undefined || templates.web !== undefined) {
    const problem = checkAssemblyPrerequisites(root, feature, templates);
    if (problem !== undefined) {
      notices.push(`${problem} Update the application binding or provider explicitly; evolve left bindings and package.json unchanged.`);
    }
  }
  if (Object.keys(read.requirements.packages).length > 0) {
    const manifestPath = path.resolve(root, 'package.json');
    let dependencies: Record<string, unknown> = {};
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { dependencies?: unknown };
      if (manifest.dependencies !== undefined) {
        if (typeof manifest.dependencies !== 'object' || manifest.dependencies === null || Array.isArray(manifest.dependencies)) {
          notices.push('package.json holds a non-object "dependencies" entry; evolve left package.json unchanged.');
        } else {
          dependencies = manifest.dependencies as Record<string, unknown>;
        }
      }
    } catch {
      notices.push('package.json is missing or unreadable; evolve left package.json unchanged.');
    }
    for (const [name, version] of Object.entries(read.requirements.packages)) {
      if (dependencies[name] === undefined) {
        notices.push(`Package "${name}" is required by "${feature}" but missing from package.json dependencies.`);
      } else if (dependencies[name] !== version) {
        notices.push(`Package "${name}" is required by "${feature}" as "${version}" but package.json declares "${String(dependencies[name])}".`);
      }
    }
  }
  return notices;
}
