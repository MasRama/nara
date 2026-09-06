import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { readFeatureRequirements } from '../composition/requirements';
import { readTransitionChecks, type TransitionObligation } from './transition';

export interface ObligationContext {
  root: string;
  feature: string;
  base: ReadonlyMap<string, Buffer>;
  local: ReadonlyMap<string, Buffer>;
  incoming: ReadonlyMap<string, Buffer>;
  candidate: ReadonlyMap<string, Buffer>;
  conflicts: string[];
  officialDirectory?: string;
}

function sortedPaths(files: ReadonlyMap<string, Buffer>): string[] {
  return [...files.keys()].sort();
}

function exportedNamesOfSource(sourceText: string, fileName: string): Set<string> {
  const names = new Set<string>();
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
      if (node.name) names.add(node.name.text);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      names.add(node.name.text);
    } else if (ts.isClassDeclaration(node) && node.name) {
      names.add(node.name.text);
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        collectBindingNames(declaration.name, names);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function collectBindingNames(name: ts.BindingName, out: Set<string>): void {
  if (ts.isIdentifier(name)) {
    out.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) collectBindingNames(element.name, out);
  }
}

function hostOperationsOfText(sourceText: string, fileName: string): Map<string, string> {
  const operations = new Map<string, string>();
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const normalize = (value: string): string => value.replaceAll(/\s+/g, ' ').trim();
  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;
    if (!statement.name.text.endsWith('Host')) continue;
    for (const member of statement.members) {
      if (ts.isMethodSignature(member) || ts.isPropertySignature(member)) {
        const name = member.name.getText(sourceFile);
        operations.set(`${statement.name.text}.${name}`, normalize(member.getText(sourceFile)));
      }
    }
  }
  return operations;
}

function hostOperationsOfMap(files: ReadonlyMap<string, Buffer>): Map<string, string> {
  const operations = new Map<string, string>();
  for (const [relativePath, bytes] of files) {
    if (!relativePath.endsWith('host.ts')) continue;
    const text = bytes.toString('utf8');
    for (const [key, signature] of hostOperationsOfText(text, relativePath)) {
      operations.set(key, signature);
    }
  }
  return operations;
}

function bindingImplementedOps(bindingText: string): { ops: Set<string>; arity: Map<string, number> } {
  const ops = new Set<string>();
  const arity = new Map<string, number>();
  const sourceFile = ts.createSourceFile('binding.ts', bindingText, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sourceFile).replaceAll(/^["']|["']$/g, '');
      ops.add(key);
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        arity.set(key, node.initializer.parameters.length);
      } else {
        arity.set(key, 0);
      }
    } else if (ts.isMethodDeclaration(node)) {
      const key = node.name.getText(sourceFile);
      ops.add(key);
      arity.set(key, node.parameters.length);
    } else if (ts.isShorthandPropertyAssignment(node)) {
      ops.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { ops, arity };
}

function hostArity(signature: string): number {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match) return 0;
  const params = match[1].trim();
  if (params === '') return 0;
  return params.split(',').length;
}

function findBindingFile(root: string, feature: string): string | undefined {
  const candidates = [
    path.join(root, 'src', 'app', 'bindings', `${feature}.server.ts`),
    path.join(root, 'src', 'app', 'bindings', `${feature}.ts`),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

function importedProviderFeatures(bindingFile: string): Array<{ provider: string; symbols: string[] }> {
  const text = readFileSync(bindingFile, 'utf8');
  const sourceFile = ts.createSourceFile(bindingFile, text, ts.ScriptTarget.Latest, true);
  const providers = new Map<string, Set<string>>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier.getText(sourceFile).replaceAll(/^["']|["']$/g, '');
    const match = specifier.match(/features\/([a-z0-9][a-z0-9-]*)/);
    if (!match) continue;
    const provider = match[1];
    if (provider === undefined) continue;
    const symbols = providers.get(provider) ?? new Set<string>();
    const bindings = statement.importClause;
    if (bindings?.namedBindings && ts.isNamedImports(bindings.namedBindings)) {
      for (const element of bindings.namedBindings.elements) {
        symbols.add(element.propertyName?.text ?? element.name.text);
      }
    }
    providers.set(provider, symbols);
  }
  return [...providers.entries()].map(([provider, symbols]) => ({ provider, symbols: [...symbols].sort() }));
}

function providerExports(root: string, provider: string): Set<string> | undefined {
  const indexFile = path.join(root, 'src', 'features', provider, 'index.ts');
  if (!existsSync(indexFile)) return undefined;
  try {
    return exportedNamesOfSource(readFileSync(indexFile, 'utf8'), indexFile);
  } catch {
    return undefined;
  }
}

function findConsumers(root: string, feature: string): string[] {
  const consumers = new Set<string>();
  const roots = [path.join(root, 'src', 'app'), path.join(root, 'src', 'features'), path.join(root, 'tests')];
  const visit = (directory: string): void => {
    if (!existsSync(directory) || !statSync(directory).isDirectory()) return;
    for (const entry of readdirSync(directory)) {
      const absolute = path.join(directory, entry);
      const stat = statSync(absolute);
      if (stat.isDirectory()) {
        if (entry === 'node_modules') continue;
        visit(absolute);
        continue;
      }
      if (!absolute.endsWith('.ts') && !absolute.endsWith('.vue')) continue;
      if (absolute.includes(`${path.sep}features${path.sep}${feature}${path.sep}`)) continue;
      let text: string;
      try {
        text = readFileSync(absolute, 'utf8');
      } catch {
        continue;
      }
      if (text.includes(`features/${feature}`)) {
        consumers.add(absolute.split(path.sep).join('/').split(`${root.split(path.sep).join('/')}/`)[1] ?? absolute);
      }
    }
  };
  for (const directory of roots) visit(directory);
  return [...consumers].sort();
}

function migrationIdsOfMap(files: ReadonlyMap<string, Buffer>): Map<string, string> {
  const ids = new Map<string, string>();
  for (const [relativePath, bytes] of files) {
    if (!relativePath.includes('migrations/') || !relativePath.endsWith('.sql')) continue;
    const base = relativePath.split('/').pop() ?? relativePath;
    const match = base.match(/^(\d+)_([a-z0-9][a-z0-9_-]*)\.sql$/);
    if (!match?.[1]) continue;
    ids.set(match[1], bytes.toString('utf8'));
  }
  return ids;
}

function readInstalledVersion(root: string, name: string): string | undefined {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  } catch {
    return undefined;
  }
}

function resolvedPackageVersion(root: string, name: string): string | undefined {
  const file = path.join(root, 'node_modules', name, 'package.json');
  if (!existsSync(file)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

function parseVersion(value: string): [number, number, number] | undefined {
  const match = value.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left: string, right: string): number | undefined {
  const l = parseVersion(left);
  const r = parseVersion(right);
  if (!l || !r) return undefined;
  for (let index = 0; index < 3; index += 1) {
    if (l[index] !== r[index]) return l[index] < r[index] ? -1 : 1;
  }
  return 0;
}

/** Minimal npm/semver compatibility for ^, ~, >=, exact, and *. Full ranges stay conservative. */
export function satisfiesRange(version: string, range: string): boolean | undefined {
  const trimmed = range.trim();
  if (trimmed === '*' || trimmed === '') return true;
  if (trimmed.startsWith('^')) {
    const base = trimmed.slice(1).trim();
    const cmp = compareVersions(version, base);
    const parsed = parseVersion(base);
    if (cmp === undefined || !parsed) return undefined;
    if (cmp < 0) return false;
    if (parsed[0] > 0) return parseVersion(version)?.[0] === parsed[0];
    if (parsed[1] > 0) return parseVersion(version)?.[0] === 0 && parseVersion(version)?.[1] === parsed[1];
    return compareVersions(version, base) === 0;
  }
  if (trimmed.startsWith('~')) {
    const base = trimmed.slice(1).trim();
    const cmp = compareVersions(version, base);
    const parsed = parseVersion(base);
    if (cmp === undefined || !parsed) return undefined;
    if (cmp < 0) return false;
    const actual = parseVersion(version);
    return actual?.[0] === parsed[0] && actual?.[1] === parsed[1];
  }
  const comparator = trimmed.match(/^(>=|<=|>|<|=)?\s*(\d+\.\d+\.\d+.*)$/);
  if (comparator?.[2]) {
    const cmp = compareVersions(version, comparator[2]);
    if (cmp === undefined) return undefined;
    switch (comparator[1] ?? '=') {
      case '=':
      case '':
        return cmp === 0;
      case '>=':
        return cmp >= 0;
      case '<=':
        return cmp <= 0;
      case '>':
        return cmp > 0;
      case '<':
        return cmp < 0;
      default:
        return undefined;
    }
  }
  const exact = compareVersions(version, trimmed);
  return exact === undefined ? undefined : exact === 0;
}

function boundaryChanged(base: ReadonlyMap<string, Buffer>, incoming: ReadonlyMap<string, Buffer>): boolean {
  for (const file of ['index.ts', 'contract.ts', 'web/index.ts']) {
    const left = base.get(file)?.toString('utf8');
    const right = incoming.get(file)?.toString('utf8');
    if (left !== right) return true;
  }
  return false;
}

export function deriveTransitionObligations(context: ObligationContext): TransitionObligation[] {
  const obligations: TransitionObligation[] = [];
  const surfaceOf = (paths: string[]): string[] => [...paths].sort();

  for (const conflict of [...context.conflicts].sort()) {
    obligations.push({
      id: `source:${conflict}`,
      category: 'source',
      reason: `Source reconciliation conflicts at ${conflict}; Nara cannot choose between local customization and upstream changes.`,
      surface: [`src/features/${context.feature}/${conflict}`],
      action: 'Resolve the conflict manually in application source, then re-evaluate the transition.',
      status: 'open',
      blocking: true,
    });
  }

  if (boundaryChanged(context.base, context.incoming)) {
    const changed = ['index.ts', 'contract.ts', 'web/index.ts'].filter(
      (file) => context.base.get(file)?.toString('utf8') !== context.incoming.get(file)?.toString('utf8'),
    );
    obligations.push({
      id: 'boundary:exports-changed',
      category: 'boundary',
      reason: `Upstream public boundary changed (${changed.join(', ')}). Compatibility is a type relationship, not export-name existence.`,
      surface: [
        ...changed.map((file) => `src/features/${context.feature}/${file}`),
        ...findConsumers(context.root, context.feature),
      ],
      action: 'Review the boundary diff and prove affected consumers with typecheck and relevant tests.',
      status: 'open',
      blocking: true,
    });
  }

  const baseHost = hostOperationsOfMap(context.base);
  const incomingHost = hostOperationsOfMap(context.incoming);
  const added = [...incomingHost.keys()].filter((key) => !baseHost.has(key)).sort();
  const removed = [...baseHost.keys()].filter((key) => !incomingHost.has(key)).sort();
  const changedSignatures = [...incomingHost.keys()]
    .filter((key) => baseHost.has(key) && baseHost.get(key) !== incomingHost.get(key))
    .sort();
  if (added.length > 0 || removed.length > 0 || changedSignatures.length > 0) {
    const parts: string[] = [];
    if (added.length > 0) parts.push(`new required operations: ${added.join(', ')}`);
    if (removed.length > 0) parts.push(`removed operations: ${removed.join(', ')}`);
    if (changedSignatures.length > 0) parts.push(`changed signatures: ${changedSignatures.join(', ')}`);
    obligations.push({
      id: 'host:requirements-changed',
      category: 'host',
      reason: `Effective host requirements changed (${parts.join('; ')}).`,
      surface: surfaceOf(
        sortedPaths(context.incoming)
          .filter((file) => file.endsWith('host.ts'))
          .map((file) => `src/features/${context.feature}/${file}`),
      ),
      action: 'Adapt the application-owned binding to the candidate host contract without changing Feature source.',
      status: 'open',
      blocking: true,
    });
  }

  const bindingFile = findBindingFile(context.root, context.feature);
  if (bindingFile === undefined) {
    obligations.push({
      id: 'binding:active-unknown',
      category: 'binding',
      reason: 'Nara cannot prove which application binding is active for the candidate host contract.',
      surface: ['src/app/bindings/', 'src/app/server.ts'],
      action: 'Keep the binding application-owned and explicitly composed from the canonical server root.',
      status: 'open',
      blocking: false,
      limitations: ['Dynamic or non-canonical composition prevents proving the active binding.'],
    });
  } else {
    const relativeBinding = bindingFile.split(`${context.root}/`)[1] ?? bindingFile;
    const bindingText = readFileSync(bindingFile, 'utf8');
    const implemented = bindingImplementedOps(bindingText);
    const missing = [...incomingHost.keys()]
      .map((key) => key.split('.').pop() ?? key)
      .filter((operation) => !implemented.ops.has(operation))
      .sort();
    const arityMismatches = [...incomingHost.entries()]
      .map(([key, signature]) => {
        const operation = key.split('.').pop() ?? key;
        const expected = hostArity(signature);
        const actual = implemented.arity.get(operation);
        return actual !== undefined && actual !== expected ? `${operation} (host expects ${expected}, binding has ${actual})` : undefined;
      })
      .filter((entry): entry is string => entry !== undefined)
      .sort();
    if (missing.length > 0 || arityMismatches.length > 0) {
      const details = [...missing.map((op) => `missing ${op}`), ...arityMismatches.map((op) => `arity ${op}`)].join('; ');
      obligations.push({
        id: 'binding:unsatisfied-host',
        category: 'binding',
        reason: `Candidate binding does not satisfy the candidate host contract (${details}). Bindings remain application-owned; Nara does not rewrite them.`,
        surface: [relativeBinding],
        action: 'Edit the application-owned binding to implement the new host operations, then re-evaluate.',
        status: 'open',
        blocking: true,
      });
    }
    for (const { provider, symbols } of importedProviderFeatures(bindingFile)) {
      if (provider === context.feature) continue;
      const exports = providerExports(context.root, provider);
      if (exports === undefined) {
        obligations.push({
          id: `provider:${provider}-unknown`,
          category: 'provider',
          reason: `Binding consumes provider "${provider}", but Nara cannot prove that provider surface.`,
          surface: [relativeBinding, `src/features/${provider}/index.ts`],
          action: 'Confirm the selected provider still satisfies the candidate binding.',
          status: 'open',
          blocking: false,
          limitations: ['Provider surface could not be proven statically.'],
        });
        continue;
      }
      const absent = symbols.filter((symbol) => !exports.has(symbol)).sort();
      if (absent.length > 0) {
        obligations.push({
          id: `provider:${provider}-incompatible`,
          category: 'provider',
          reason: `Selected provider "${provider}" no longer exports ${absent.join(', ')} required by the binding.`,
          surface: [relativeBinding, `src/features/${provider}/index.ts`],
          action: 'Choose a provider that satisfies the candidate binding; Nara never auto-installs providers.',
          status: 'open',
          blocking: true,
        });
      }
    }
  }

  try {
    const officialDirectory = context.officialDirectory ?? path.join(context.root, 'official-features', context.feature);
    const requirements = readFeatureRequirements(existsSync(officialDirectory) ? officialDirectory : context.root);
    if (requirements.ok && requirements.requirements?.packages) {
      for (const [name, range] of Object.entries(requirements.requirements.packages).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      )) {
        const declared = readInstalledVersion(context.root, name);
        if (declared === undefined) {
          obligations.push({
            id: `package:${name}-missing`,
            category: 'package',
            reason: `Candidate requires npm package ${name}@${range}, which is not declared in package.json.`,
            surface: ['package.json'],
            action: 'Ask the application owner to update package.json with a package manager; Nara never runs npm install.',
            status: 'open',
            blocking: true,
          });
          continue;
        }
        const resolved = resolvedPackageVersion(context.root, name);
        const checkVersion = resolved ?? declared.replace(/^[~^>=<\s]+/, '');
        const satisfied = satisfiesRange(checkVersion, range);
        if (satisfied === false) {
          obligations.push({
            id: `package:${name}-incompatible`,
            category: 'package',
            reason: `Declared ${name}@${declared} does not satisfy candidate requirement ${range}.`,
            surface: ['package.json', 'package-lock.json'],
            action: 'Update the prerequisite with a package manager, then revalidate the candidate revision.',
            status: 'open',
            blocking: true,
          });
        } else if (satisfied === undefined || resolved === undefined) {
          obligations.push({
            id: `package:${name}-unresolved`,
            category: 'package',
            reason: `Candidate requires ${name}@${range}; installed resolution evidence is unavailable.`,
            surface: ['package.json', 'package-lock.json'],
            action: 'Install and report the resolved environment before acceptance.',
            status: 'open',
            blocking: false,
            limitations: ['Package resolution evidence is unavailable without node_modules or a lockfile entry.'],
          });
        }
      }
    }
  } catch {
    obligations.push({
      id: 'package:requirements-unreadable',
      category: 'package',
      reason: 'Incoming package requirements could not be evaluated.',
      surface: ['package.json'],
      action: 'Inspect incoming requirements metadata and the installed package state manually.',
      status: 'open',
      blocking: false,
      limitations: ['Requirement metadata could not be parsed.'],
    });
  }

  const incomingTouchesComposition = sortedPaths(context.incoming).some(
    (file) => file.includes('routes') || file.startsWith('web/') || file === 'index.ts',
  );
  const baseTouchesComposition = sortedPaths(context.base).some(
    (file) => file.includes('routes') || file.startsWith('web/') || file === 'index.ts',
  );
  if (incomingTouchesComposition || baseTouchesComposition) {
    const incomingRoutes = sortedPaths(context.incoming)
      .filter((file) => file.includes('routes') || file.startsWith('web/'))
      .map((file) => `src/features/${context.feature}/${file}`);
    if (incomingRoutes.length > 0) {
      obligations.push({
        id: 'integration:composition-changed',
        category: 'integration',
        reason: 'Candidate changes server/web composition surfaces that the canonical roots consume.',
        surface: surfaceOf([...incomingRoutes, 'src/app/server.ts', 'src/app/router.ts']),
        action: 'Prove canonical composition with architecture diff evidence.',
        status: 'open',
        blocking: false,
      });
    }
  }

  const baseMigrations = migrationIdsOfMap(context.base);
  const incomingMigrations = migrationIdsOfMap(context.incoming);
  const addedMigrations = [...incomingMigrations.keys()].filter((id) => !baseMigrations.has(id)).sort();
  if (addedMigrations.length > 0) {
    obligations.push({
      id: 'migration:rehearse-new',
      category: 'migration',
      reason: `Candidate adds forward migrations (${addedMigrations.join(', ')}). Fresh and existing-history rehearsals are required.`,
      surface: surfaceOf(
        sortedPaths(context.incoming)
          .filter((file) => file.includes('migrations/'))
          .map((file) => `src/features/${context.feature}/${file}`),
      ),
      action: 'Rehearse the candidate migration set against a fresh DB and a representative history fixture.',
      status: 'open',
      blocking: true,
    });
  }

  const hostOrBindingBlocking = obligations.some(
    (obligation) => (obligation.category === 'host' || obligation.category === 'binding') && obligation.blocking,
  );
  if (hostOrBindingBlocking || boundaryChanged(context.base, context.incoming)) {
    const checks = readTransitionChecks(context.root, context.feature);
    const tests = checks?.tests ?? [`src/features/${context.feature}/tests`, 'tests'];
    obligations.push({
      id: 'behavioral:application-tests',
      category: 'behavioral',
      reason:
        'Structural compatibility cannot prove application policy. Application-owned tests must cover the adapted behavior.',
      surface: surfaceOf(tests),
      action: 'Run the nominated application-owned tests against the exact candidate revision.',
      status: 'open',
      blocking: true,
      limitations: ['Nara never infers full business intent from structural analysis.'],
    });
  }

  return obligations.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}
