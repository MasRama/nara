import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { defaultComposeFunction, defaultRouteArray, sourceFileHasSyntaxErrors } from '../composition/assembly';
import { discoverFeatures } from './discover-features';
import { featureReferenceFromSpecifier, type FeatureBoundary } from './discover-import-evidence';
export interface ApplicationFeatureImport {
  feature: string;
  appFile: string;
  boundary: FeatureBoundary;
  symbols: string[];
}

export interface ServerRouteIntegration {
  feature: string;
  appFile: string;
  exportName: string;
  mountPath: string;
}

export interface WebRouteIntegration {
  feature: string;
  appFile: string;
  exportName: string;
  path: string;
  name?: string;
}

export interface FeatureIntegrationFacts {
  applicationImports: ApplicationFeatureImport[];
  serverRoutes: ServerRouteIntegration[];
  webRoutes: WebRouteIntegration[];
}

export type FeatureIntegrationFactsByFeature = Record<string, FeatureIntegrationFacts>;

interface FeatureBinding {
  feature: string;
  boundary: FeatureBoundary;
  exportName: string;
}

interface NamespaceBinding {
  feature: string;
  boundary: FeatureBoundary;
}

interface RootAnalysis {
  sourceFile: ts.SourceFile;
  bindings: Map<string, FeatureBinding>;
  namespaces: Map<string, NamespaceBinding>;
  values: Map<string, ts.Expression>;
  honoInstances: Set<string>;
  vueRouterFactories: Set<string>;
}

const APPLICATION_ROOTS = {
  server: 'src/app/server.ts',
  web: 'src/app/router.ts',
} as const;
const BINDINGS_DIRECTORY = 'src/app/bindings';

function parseSourceFile(absoluteFile: string): ts.SourceFile | undefined {
  let source: string;
  try {
    source = readFileSync(absoluteFile, 'utf8');
  } catch {
    return undefined;
  }
  const parsed = ts.createSourceFile(absoluteFile, source, ts.ScriptTarget.Latest, true);
  if (sourceFileHasSyntaxErrors(parsed)) {
    return undefined;
  }
  return parsed;
}

/**
 * Resolve an application import to an application-owned binding file. Only
 * relative specifiers that land inside `src/app/bindings/` qualify; anything
 * else is ordinary application code, not an assembly binding.
 */
function resolveBindingFile(importerFile: string, specifier: string, root: string): string | undefined {
  if (!specifier.startsWith('.')) {
    return undefined;
  }
  const resolved = path.resolve(path.dirname(importerFile), specifier);
  const candidates = [
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.mts`,
    `${resolved}.cts`,
    resolved,
    path.join(resolved, 'index.ts'),
    path.join(resolved, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    const relative = toPosix(path.relative(root, candidate));
    if (relative === BINDINGS_DIRECTORY || relative.startsWith(`${BINDINGS_DIRECTORY}/`)) {
      return candidate;
    }
    return undefined;
  }
  return undefined;
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

function appFilePath(root: string, absoluteFile: string): string {
  return toPosix(path.relative(root, absoluteFile));
}

function emptyFacts(): FeatureIntegrationFacts {
  return { applicationImports: [], serverRoutes: [], webRoutes: [] };
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function propertyName(property: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(property) || ts.isStringLiteral(property) || ts.isNumericLiteral(property)) {
    return property.text;
  }
  return undefined;
}

function staticString(expression: ts.Expression): string | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }
  return undefined;
}

function propertyInitializer(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      continue;
    }
    const key = propertyName(property.name);
    if (key !== name) {
      continue;
    }
    return ts.isPropertyAssignment(property) ? property.initializer : property.name;
  }
  return undefined;
}

function collectValues(sourceFile: ts.SourceFile): Map<string, ts.Expression> {
  const values = new Map<string, ts.Expression>();
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      values.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return values;
}

function routeObject(
  expression: ts.Expression,
  values: Map<string, ts.Expression>,
  seenNames = new Set<string>(),
): ts.ObjectLiteralExpression | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return unwrapped;
  }
  if (!ts.isIdentifier(unwrapped) || seenNames.has(unwrapped.text)) {
    return undefined;
  }
  const initializer = values.get(unwrapped.text);
  if (!initializer) {
    return undefined;
  }
  const nextSeen = new Set(seenNames);
  nextSeen.add(unwrapped.text);
  return routeObject(initializer, values, nextSeen);
}
function importedBindingName(element: ts.ImportSpecifier): string {
  return element.propertyName?.text ?? element.name.text;
}

interface ScannedFeatureImports {
  bindings: Map<string, FeatureBinding>;
  namespaces: Map<string, NamespaceBinding>;
}

/**
 * Record every Feature-boundary import of one application source file. Shared
 * by the canonical roots and by actively consumed application bindings so
 * both report the same application-import facts.
 */
function scanFeatureImports(
  sourceFile: ts.SourceFile,
  absoluteFile: string,
  root: string,
  knownFeatures: Set<string>,
  addImport: (fact: ApplicationFeatureImport) => void,
): ScannedFeatureImports {
  const bindings = new Map<string, FeatureBinding>();
  const namespaces = new Map<string, NamespaceBinding>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const clause = statement.importClause;
    const reference = featureReferenceFromSpecifier(statement.moduleSpecifier.text, absoluteFile, root);
    if (!reference?.boundary || !knownFeatures.has(reference.name)) {
      continue;
    }
    const appFile = appFilePath(root, absoluteFile);
    const symbols: string[] = [];
    if (!clause) {
      addImport({ feature: reference.name, appFile, boundary: reference.boundary, symbols });
      continue;
    }
    if (clause.name) {
      symbols.push('default');
      if (!clause.isTypeOnly) {
        bindings.set(clause.name.text, {
          feature: reference.name,
          boundary: reference.boundary,
          exportName: 'default',
        });
      }
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        const exportName = importedBindingName(element);
        symbols.push(exportName);
        if (!clause.isTypeOnly && !element.isTypeOnly) {
          bindings.set(element.name.text, {
            feature: reference.name,
            boundary: reference.boundary,
            exportName,
          });
        }
      }
    } else if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      symbols.push('*');
      if (!clause.isTypeOnly) {
        namespaces.set(clause.namedBindings.name.text, {
          feature: reference.name,
          boundary: reference.boundary,
        });
      }
    }
    addImport({
      feature: reference.name,
      appFile,
      boundary: reference.boundary,
      symbols: [...new Set(symbols)].sort(),
    });
  }
  return { bindings, namespaces };
}

function analyzeRoot(
  absoluteFile: string,
  root: string,
  knownFeatures: Set<string>,
  addImport: (fact: ApplicationFeatureImport) => void,
): RootAnalysis | undefined {
  if (!existsSync(absoluteFile)) {
    return undefined;
  }

  let source: string;
  try {
    source = readFileSync(absoluteFile, 'utf8');
  } catch {
    return undefined;
  }

  const sourceFile = ts.createSourceFile(absoluteFile, source, ts.ScriptTarget.Latest, true);
  const honoConstructors = new Set<string>();
  const vueRouterFactories = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const clause = statement.importClause;
    if (clause && !clause.isTypeOnly && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (element.isTypeOnly) {
          continue;
        }
        const importedName = importedBindingName(element);
        if (statement.moduleSpecifier.text === 'hono' && importedName === 'Hono') {
          honoConstructors.add(element.name.text);
        }
        if (statement.moduleSpecifier.text === 'vue-router' && importedName === 'createRouter') {
          vueRouterFactories.add(element.name.text);
        }
      }
    }
  }

  const { bindings, namespaces } = scanFeatureImports(sourceFile, absoluteFile, root, knownFeatures, addImport);

  const honoInstances = new Set<string>();
  if (honoConstructors.size > 0) {
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) {
        continue;
      }
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }
        const initializer = unwrapExpression(declaration.initializer);
        if (!ts.isNewExpression(initializer)) {
          continue;
        }
        const constructor = unwrapExpression(initializer.expression);
        if (ts.isIdentifier(constructor) && honoConstructors.has(constructor.text)) {
          honoInstances.add(declaration.name.text);
        }
      }
    }
  }

  return {
    sourceFile,
    bindings,
    namespaces,
    values: collectValues(sourceFile),
    honoInstances,
    vueRouterFactories,
  };
}

function importedBinding(
  expression: ts.Expression,
  analysis: ScannedFeatureImports,
): FeatureBinding | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isIdentifier(unwrapped)) {
    return analysis.bindings.get(unwrapped.text);
  }
  if (ts.isPropertyAccessExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)) {
    const namespace = analysis.namespaces.get(unwrapped.expression.text);
    if (!namespace) {
      return undefined;
    }
    return { ...namespace, exportName: unwrapped.name.text };
  }
  return undefined;
}
function addServerRoute(
  facts: FeatureIntegrationFactsByFeature,
  route: ServerRouteIntegration,
): void {
  const current = facts[route.feature];
  if (!current) {
    return;
  }
  if (
    current.serverRoutes.some(
      (candidate) =>
        candidate.appFile === route.appFile &&
        candidate.exportName === route.exportName &&
        candidate.mountPath === route.mountPath,
    )
  ) {
    return;
  }
  current.serverRoutes.push(route);
}

function addWebRoute(facts: FeatureIntegrationFactsByFeature, route: WebRouteIntegration): void {
  const current = facts[route.feature];
  if (!current) {
    return;
  }
  if (
    current.webRoutes.some(
      (candidate) =>
        candidate.appFile === route.appFile &&
        candidate.exportName === route.exportName &&
        candidate.path === route.path &&
        candidate.name === route.name,
    )
  ) {
    return;
  }
  current.webRoutes.push(route);
}

function discoverServerRoutes(
  analysis: RootAnalysis,
  root: string,
  facts: FeatureIntegrationFactsByFeature,
): void {
  const appFile = appFilePath(root, analysis.sourceFile.fileName);
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      if (node.expression.name.text === 'route' && node.arguments.length >= 2) {
        const receiver = unwrapExpression(node.expression.expression);
        if (ts.isIdentifier(receiver) && analysis.honoInstances.has(receiver.text)) {
          const mountPath = staticString(node.arguments[0]);
          const binding = importedBinding(node.arguments[1], analysis);
          if (mountPath !== undefined && binding?.boundary === 'public') {
            addServerRoute(facts, {
              feature: binding.feature,
              appFile,
              exportName: binding.exportName,
              mountPath,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(analysis.sourceFile);
}
function joinRoutePath(parent: string | undefined, child: string): string {
  if (parent === undefined || child.startsWith('/')) {
    return child;
  }
  if (child.length === 0) {
    return parent;
  }
  if (parent === '/') {
    return `/${child.replace(/^\/+/, '')}`;
  }
  return `${parent.replace(/\/+$/, '')}/${child.replace(/^\/+/, '')}`;
}

function provenRouteRoots(analysis: RootAnalysis): ts.Expression[] {
  const routeRoots: ts.Expression[] = [];
  function findRouterCalls(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      analysis.vueRouterFactories.has(node.expression.text) &&
      node.arguments.length > 0
    ) {
      const options = unwrapExpression(node.arguments[0]);
      if (ts.isObjectLiteralExpression(options)) {
        const routes = propertyInitializer(options, 'routes');
        if (routes) {
          routeRoots.push(routes);
        }
      }
    }
    ts.forEachChild(node, findRouterCalls);
  }
  findRouterCalls(analysis.sourceFile);
  return routeRoots;
}

export interface WalkedWebRecord {
  binding: FeatureBinding;
  path: string;
  name?: string;
}

/**
 * Walk a statically provable Vue Router record tree. Shared by direct
 * application composition and by application-owned binding files so both
 * report the same web-route facts.
 */
function walkWebRecords(
  expression: ts.Expression,
  values: Map<string, ts.Expression>,
  resolveBinding: (candidate: ts.Expression) => FeatureBinding | undefined,
  onRecord: (record: WalkedWebRecord) => void,
  parentPath: string | undefined = undefined,
  seenArrays = new Set<string>(),
): void {
  const unwrapped = unwrapExpression(expression);
  if (ts.isIdentifier(unwrapped)) {
    if (seenArrays.has(unwrapped.text)) {
      return;
    }
    const nextSeen = new Set(seenArrays);
    nextSeen.add(unwrapped.text);
    const initializer = values.get(unwrapped.text);
    if (!initializer) {
      return;
    }
    walkWebRecords(initializer, values, resolveBinding, onRecord, parentPath, nextSeen);
    return;
  }
  if (!ts.isArrayLiteralExpression(unwrapped)) {
    return;
  }
  for (const element of unwrapped.elements) {
    if (ts.isSpreadElement(element)) {
      walkWebRecords(element.expression, values, resolveBinding, onRecord, parentPath, seenArrays);
      continue;
    }
    const record = routeObject(element, values);
    if (!record) {
      continue;
    }
    const ownPathExpression = propertyInitializer(record, 'path');
    const ownPath = ownPathExpression ? staticString(ownPathExpression) : undefined;
    const effectivePath = ownPath === undefined ? undefined : joinRoutePath(parentPath, ownPath);
    const componentExpression = propertyInitializer(record, 'component');
    const binding = componentExpression ? resolveBinding(componentExpression) : undefined;
    if (effectivePath !== undefined && binding?.boundary === 'web') {
      const nameExpression = propertyInitializer(record, 'name');
      const name = nameExpression ? staticString(nameExpression) : undefined;
      if (name !== undefined) {
        onRecord({ binding, path: effectivePath, name });
      } else {
        onRecord({ binding, path: effectivePath });
      }
    }
    const children = propertyInitializer(record, 'children');
    if (children && effectivePath !== undefined) {
      walkWebRecords(children, values, resolveBinding, onRecord, effectivePath, seenArrays);
    }
  }
}

function discoverWebRoutes(
  analysis: RootAnalysis,
  root: string,
  facts: FeatureIntegrationFactsByFeature,
): void {
  const appFile = appFilePath(root, analysis.sourceFile.fileName);
  for (const routeRoot of provenRouteRoots(analysis)) {
    walkWebRecords(
      routeRoot,
      analysis.values,
      (candidate) => importedBinding(candidate, analysis),
      (record) => {
        addWebRoute(facts, {
          feature: record.binding.feature,
          appFile,
          exportName: record.binding.exportName,
          path: record.path,
          ...(record.name === undefined ? {} : { name: record.name }),
        });
      },
    );
  }
}

interface BindingImportTargets {
  defaults: Map<string, string>;
  namespaces: Map<string, string>;
}

function bindingImportTargets(
  sourceFile: ts.SourceFile,
  absoluteFile: string,
  root: string,
): BindingImportTargets {
  const defaults = new Map<string, string>();
  const namespaces = new Map<string, string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const bindingFile = resolveBindingFile(absoluteFile, statement.moduleSpecifier.text, root);
    if (!bindingFile) {
      continue;
    }
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) {
      continue;
    }
    if (clause.name) {
      defaults.set(clause.name.text, bindingFile);
    }
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      namespaces.set(clause.namedBindings.name.text, bindingFile);
    }
  }
  return { defaults, namespaces };
}

function bindingCallTarget(
  expression: ts.Expression,
  targets: BindingImportTargets,
): string | undefined {
  const callee = unwrapExpression(expression);
  if (ts.isIdentifier(callee)) {
    return targets.defaults.get(callee.text);
  }
  if (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === 'default' &&
    ts.isIdentifier(callee.expression)
  ) {
    return targets.namespaces.get(callee.expression.text);
  }
  return undefined;
}

/**
 * Prove the server assembly chain: the canonical root imports an
 * application-owned binding and calls it with the proven Hono instance, and
 * the binding mounts a Feature public export with `.route()` on the instance
 * it receives. A binding file that merely exists is never enough.
 */
function discoverServerAssemblyRoutes(
  serverFile: string,
  analysis: RootAnalysis,
  root: string,
  knownFeatures: Set<string>,
  addImport: (fact: ApplicationFeatureImport) => void,
  facts: FeatureIntegrationFactsByFeature,
): void {
  const targets = bindingImportTargets(analysis.sourceFile, serverFile, root);
  if (targets.defaults.size === 0 && targets.namespaces.size === 0) {
    return;
  }
  const active = new Set<string>();
  function findActivations(node: ts.Node): void {
    if (ts.isCallExpression(node) && node.arguments.length >= 1) {
      const first = unwrapExpression(node.arguments[0]);
      if (ts.isIdentifier(first) && analysis.honoInstances.has(first.text)) {
        const bindingFile = bindingCallTarget(node.expression, targets);
        if (bindingFile) {
          active.add(bindingFile);
        }
      }
    }
    ts.forEachChild(node, findActivations);
  }
  findActivations(analysis.sourceFile);
  const appFile = appFilePath(root, analysis.sourceFile.fileName);
  for (const bindingFile of [...active].sort()) {
    const bindingSource = parseSourceFile(bindingFile);
    if (!bindingSource) {
      continue;
    }
    const scanned = scanFeatureImports(bindingSource, bindingFile, root, knownFeatures, addImport);
    const composed = defaultComposeFunction(bindingSource);
    if (!composed) {
      continue;
    }
    const { param, body } = composed;
    function findMounts(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'route' &&
        node.arguments.length >= 2
      ) {
        const receiver = unwrapExpression(node.expression.expression);
        if (ts.isIdentifier(receiver) && receiver.text === param) {
          const mountPath = staticString(node.arguments[0]);
          const binding = importedBinding(node.arguments[1], scanned);
          if (mountPath !== undefined && binding?.boundary === 'public') {
            addServerRoute(facts, {
              feature: binding.feature,
              appFile,
              exportName: binding.exportName,
              mountPath,
            });
          }
        }
      }
      ts.forEachChild(node, findMounts);
    }
    findMounts(body);
  }
}

function bindingSpreadTarget(
  expression: ts.Expression,
  targets: BindingImportTargets,
): string | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isIdentifier(unwrapped)) {
    return targets.defaults.get(unwrapped.text);
  }
  if (
    ts.isPropertyAccessExpression(unwrapped) &&
    unwrapped.name.text === 'default' &&
    ts.isIdentifier(unwrapped.expression)
  ) {
    return targets.namespaces.get(unwrapped.expression.text);
  }
  return undefined;
}

/**
 * Prove the web assembly chain: the canonical router imports an
 * application-owned binding route array and spreads it into the proven
 * `createRouter({ routes })` array, and the binding record references a
 * Feature web public export. Unspread bindings stay inactive.
 */
function discoverWebAssemblyRoutes(
  routerFile: string,
  analysis: RootAnalysis,
  root: string,
  knownFeatures: Set<string>,
  addImport: (fact: ApplicationFeatureImport) => void,
  facts: FeatureIntegrationFactsByFeature,
): void {
  const targets = bindingImportTargets(analysis.sourceFile, routerFile, root);
  if (targets.defaults.size === 0 && targets.namespaces.size === 0) {
    return;
  }
  const active = new Set<string>();
  function findSpreads(expression: ts.Expression, seenArrays = new Set<string>()): void {
    const unwrapped = unwrapExpression(expression);
    if (ts.isIdentifier(unwrapped)) {
      if (seenArrays.has(unwrapped.text)) {
        return;
      }
      const nextSeen = new Set(seenArrays);
      nextSeen.add(unwrapped.text);
      const initializer = analysis.values.get(unwrapped.text);
      if (!initializer) {
        return;
      }
      findSpreads(initializer, nextSeen);
      return;
    }
    if (!ts.isArrayLiteralExpression(unwrapped)) {
      return;
    }
    for (const element of unwrapped.elements) {
      if (!ts.isSpreadElement(element)) {
        continue;
      }
      const bindingFile = bindingSpreadTarget(element.expression, targets);
      if (bindingFile) {
        active.add(bindingFile);
        continue;
      }
      findSpreads(element.expression, seenArrays);
    }
  }
  for (const routeRoot of provenRouteRoots(analysis)) {
    findSpreads(routeRoot);
  }
  const appFile = appFilePath(root, analysis.sourceFile.fileName);
  for (const bindingFile of [...active].sort()) {
    const bindingSource = parseSourceFile(bindingFile);
    if (!bindingSource) {
      continue;
    }
    const scanned = scanFeatureImports(bindingSource, bindingFile, root, knownFeatures, addImport);
    const routes = defaultRouteArray(bindingSource);
    if (!routes) {
      continue;
    }
    walkWebRecords(
      routes,
      collectValues(bindingSource),
      (candidate) => importedBinding(candidate, scanned),
      (record) => {
        addWebRoute(facts, {
          feature: record.binding.feature,
          appFile,
          exportName: record.binding.exportName,
          path: record.path,
          ...(record.name === undefined ? {} : { name: record.name }),
        });
      },
    );
  }
}

function sortFacts(facts: FeatureIntegrationFactsByFeature): void {
  for (const current of Object.values(facts)) {
    for (const importFact of current.applicationImports) {
      importFact.symbols = [...new Set(importFact.symbols)].sort();
    }
    current.applicationImports.sort(
      (left, right) =>
        left.feature.localeCompare(right.feature) ||
        left.appFile.localeCompare(right.appFile) ||
        left.boundary.localeCompare(right.boundary),
    );
    current.serverRoutes.sort(
      (left, right) =>
        left.appFile.localeCompare(right.appFile) ||
        left.mountPath.localeCompare(right.mountPath) ||
        left.exportName.localeCompare(right.exportName),
    );
    current.webRoutes.sort(
      (left, right) =>
        left.appFile.localeCompare(right.appFile) ||
        left.path.localeCompare(right.path) ||
        (left.name ?? '').localeCompare(right.name ?? '') ||
        left.exportName.localeCompare(right.exportName),
    );
  }
}

export function discoverFeatureIntegrations(root = process.cwd()): FeatureIntegrationFactsByFeature {
  const discovery = discoverFeatures(root);
  const facts: FeatureIntegrationFactsByFeature = {};
  const knownFeatures = new Set(discovery.features.map((feature) => feature.name));
  for (const feature of [...discovery.features].sort((left, right) => left.name.localeCompare(right.name))) {
    facts[feature.name] = emptyFacts();
  }

  const addImport = (fact: ApplicationFeatureImport): void => {
    const current = facts[fact.feature];
    if (!current) {
      return;
    }
    const existing = current.applicationImports.find(
      (candidate) =>
        candidate.appFile === fact.appFile && candidate.boundary === fact.boundary,
    );
    if (existing) {
      existing.symbols = [...new Set([...existing.symbols, ...fact.symbols])].sort();
      return;
    }
    current.applicationImports.push({ ...fact, symbols: [...new Set(fact.symbols)].sort() });
  };

  const serverFile = path.resolve(root, APPLICATION_ROOTS.server);
  const serverAnalysis = analyzeRoot(serverFile, root, knownFeatures, addImport);
  if (serverAnalysis) {
    discoverServerRoutes(serverAnalysis, root, facts);
    discoverServerAssemblyRoutes(serverFile, serverAnalysis, root, knownFeatures, addImport, facts);
  }

  const routerFile = path.resolve(root, APPLICATION_ROOTS.web);
  const webAnalysis = analyzeRoot(routerFile, root, knownFeatures, addImport);
  if (webAnalysis) {
    discoverWebRoutes(webAnalysis, root, facts);
    discoverWebAssemblyRoutes(routerFile, webAnalysis, root, knownFeatures, addImport, facts);
  }

  sortFacts(facts);
  return facts;
}
