import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
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
  const bindings = new Map<string, FeatureBinding>();
  const namespaces = new Map<string, NamespaceBinding>();
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
  analysis: RootAnalysis,
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

function discoverWebRoutes(
  analysis: RootAnalysis,
  root: string,
  facts: FeatureIntegrationFactsByFeature,
): void {
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

  const appFile = appFilePath(root, analysis.sourceFile.fileName);
  function visitRoutes(expression: ts.Expression, parentPath: string | undefined, seenArrays = new Set<string>()): void {
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
      visitRoutes(initializer, parentPath, nextSeen);
      return;
    }
    if (!ts.isArrayLiteralExpression(unwrapped)) {
      return;
    }

    for (const element of unwrapped.elements) {
      if (ts.isSpreadElement(element)) {
        visitRoutes(element.expression, parentPath, seenArrays);
        continue;
      }
      const record = routeObject(element, analysis.values);
      if (!record) {
        continue;
      }
      const ownPathExpression = propertyInitializer(record, 'path');
      const ownPath = ownPathExpression ? staticString(ownPathExpression) : undefined;
      const effectivePath = ownPath === undefined ? undefined : joinRoutePath(parentPath, ownPath);
      const componentExpression = propertyInitializer(record, 'component');
      const binding = componentExpression ? importedBinding(componentExpression, analysis) : undefined;
      if (effectivePath !== undefined && binding?.boundary === 'web') {
        const nameExpression = propertyInitializer(record, 'name');
        const name = nameExpression ? staticString(nameExpression) : undefined;
        const route: WebRouteIntegration = {
          feature: binding.feature,
          appFile,
          exportName: binding.exportName,
          path: effectivePath,
        };
        if (name !== undefined) {
          route.name = name;
        }
        addWebRoute(facts, route);
      }

      const children = propertyInitializer(record, 'children');
      if (children && effectivePath !== undefined) {
        visitRoutes(children, effectivePath, seenArrays);
      }
    }
  }

  for (const routeRoot of routeRoots) {
    visitRoutes(routeRoot, undefined);
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

  const serverAnalysis = analyzeRoot(
    path.resolve(root, APPLICATION_ROOTS.server),
    root,
    knownFeatures,
    addImport,
  );
  if (serverAnalysis) {
    discoverServerRoutes(serverAnalysis, root, facts);
  }

  const webAnalysis = analyzeRoot(
    path.resolve(root, APPLICATION_ROOTS.web),
    root,
    knownFeatures,
    addImport,
  );
  if (webAnalysis) {
    discoverWebRoutes(webAnalysis, root, facts);
  }

  sortFacts(facts);
  return facts;
}
