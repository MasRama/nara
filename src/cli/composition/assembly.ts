import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const ASSEMBLY_DIRECTORY_NAME = '.nara/assembly';
export const ASSEMBLY_SERVER_TEMPLATE = 'server.ts';
export const ASSEMBLY_WEB_TEMPLATE = 'web.ts';

export const CANONICAL_SERVER_ROOT = 'src/app/server.ts';
export const CANONICAL_WEB_ROOT = 'src/app/router.ts';
export const BINDINGS_DIRECTORY = 'src/app/bindings';

export interface AssemblyTemplates {
  server?: string;
  web?: string;
}

function toWords(name: string): string[] {
  return name.split('-').filter((word) => word.length > 0);
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1);
}

export function pascalCaseFeatureName(name: string): string {
  return toWords(name).map(capitalize).join('');
}

export function camelCaseFeatureName(name: string): string {
  const pascal = pascalCaseFeatureName(name);
  return pascal.length === 0 ? pascal : pascal[0].toLowerCase() + pascal.slice(1);
}

export function serverBindingFileName(feature: string): string {
  return `${feature}.server.ts`;
}

export function webBindingFileName(feature: string): string {
  return `${feature}.web.ts`;
}

export function serverComposeLocalName(feature: string): string {
  return `compose${pascalCaseFeatureName(feature)}Server`;
}

export function webRoutesLocalName(feature: string): string {
  return `${camelCaseFeatureName(feature)}WebRoutes`;
}

export function serverBindingSpecifier(feature: string): string {
  return `./bindings/${feature}.server`;
}

export function webBindingSpecifier(feature: string): string {
  return `./bindings/${feature}.web`;
}

export function serverBindingAppFile(feature: string): string {
  return `${BINDINGS_DIRECTORY}/${feature}.server.ts`;
}

export function webBindingAppFile(feature: string): string {
  return `${BINDINGS_DIRECTORY}/${feature}.web.ts`;
}

export function serverBindingDestination(root: string, feature: string): string {
  return path.resolve(root, BINDINGS_DIRECTORY, serverBindingFileName(feature));
}

export function webBindingDestination(root: string, feature: string): string {
  return path.resolve(root, BINDINGS_DIRECTORY, webBindingFileName(feature));
}

export function assemblyTemplateDirectory(officialDirectory: string): string {
  return path.join(officialDirectory, '.nara', 'assembly');
}

export function readAssemblyTemplates(officialDirectory: string): AssemblyTemplates {
  const templates: AssemblyTemplates = {};
  const serverPath = path.join(assemblyTemplateDirectory(officialDirectory), ASSEMBLY_SERVER_TEMPLATE);
  const webPath = path.join(assemblyTemplateDirectory(officialDirectory), ASSEMBLY_WEB_TEMPLATE);
  if (existsSync(serverPath)) {
    templates.server = readFileSync(serverPath, 'utf8');
  }
  if (existsSync(webPath)) {
    templates.web = readFileSync(webPath, 'utf8');
  }
  return templates;
}

export function hasAssemblyTemplates(officialDirectory: string): boolean {
  const templates = readAssemblyTemplates(officialDirectory);
  return templates.server !== undefined || templates.web !== undefined;
}

type TemplateBoundary = 'public' | 'web';

/**
 * Classify a template import specifier without a project root. Assembly
 * templates are authored with destination-relative paths: from
 * `src/app/bindings/<feature>.server.ts` the Feature boundary is reached
 * through `../../features/<feature>`, so the template carries that exact
 * specifier even though it does not resolve from the template's own
 * location. Root-relative aliases are accepted for the same reason.
 */
export function classifyTemplateSpecifier(specifier: string, feature: string): TemplateBoundary | undefined {
  const candidates = [
    `../../features/${feature}`,
    `@/features/${feature}`,
    `@features/${feature}`,
    `src/features/${feature}`,
  ];
  for (const base of candidates) {
    if (specifier === base || specifier === `${base}/index`) {
      return 'public';
    }
    if (specifier.startsWith(`${base}/`)) {
      const suffix = specifier.slice(base.length + 1);
      if (/^index(\.[cm]?[jt]sx?)?$/.test(suffix)) {
        return 'public';
      }
      if (suffix === 'web' || /^web\/index(\.[cm]?[jt]sx?)?$/.test(suffix)) {
        return 'web';
      }
      return undefined;
    }
  }
  return undefined;
}

export function sourceFileHasSyntaxErrors(sourceFile: ts.SourceFile): boolean {
  const parsed = sourceFile as unknown as { parseDiagnostics?: readonly unknown[] };
  return 'parseDiagnostics' in sourceFile && Array.isArray(parsed.parseDiagnostics) && parsed.parseDiagnostics.length > 0;
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

function staticStringOf(expression: ts.Expression): string | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }
  return undefined;
}

interface DefaultFunction {
  parameters: readonly ts.ParameterDeclaration[];
  body: ts.Node;
}

function defaultExportedFunction(sourceFile: ts.SourceFile): DefaultFunction | undefined {
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      if (!statement.body) {
        return undefined;
      }
      return { parameters: statement.parameters, body: statement.body };
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const unwrapped = unwrapExpression(statement.expression);
      if (ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped)) {
        if (!unwrapped.body) {
          return undefined;
        }
        return { parameters: unwrapped.parameters, body: unwrapped.body };
      }
      if (ts.isIdentifier(unwrapped)) {
        const resolved = resolveFunctionByName(sourceFile, unwrapped.text);
        if (resolved) {
          return resolved;
        }
      }
    }
  }
  return undefined;
}

function resolveFunctionByName(sourceFile: ts.SourceFile, name: string): DefaultFunction | undefined {
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.body
    ) {
      return { parameters: statement.parameters, body: statement.body };
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer
        ) {
          const unwrapped = unwrapExpression(declaration.initializer);
          if ((ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped)) && unwrapped.body) {
            return { parameters: unwrapped.parameters, body: unwrapped.body };
          }
        }
      }
    }
  }
  return undefined;
}

function collectImportSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
}

function containsRouteCallWithStaticPath(node: ts.Node): boolean {
  let found = false;
  function visit(current: ts.Node): void {
    if (found) {
      return;
    }
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name.text === 'route' &&
      current.arguments.length >= 2 &&
      staticStringOf(current.arguments[0]) !== undefined
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

export function validateServerAssemblyTemplate(source: string, feature: string): string | undefined {
  const sourceFile = ts.createSourceFile('server.ts', source, ts.ScriptTarget.Latest, true);
  if (sourceFileHasSyntaxErrors(sourceFile)) {
    return 'the template does not parse as TypeScript';
  }
  const composed = defaultExportedFunction(sourceFile);
  if (!composed) {
    return 'the template must default-export a composition function';
  }
  if (composed.parameters.length < 1 || !ts.isIdentifier(composed.parameters[0].name)) {
    return 'the default-exported composition function must take the Hono application instance as its first parameter';
  }
  const hasPublicImport = collectImportSpecifiers(sourceFile).some(
    (specifier) => classifyTemplateSpecifier(specifier, feature) === 'public',
  );
  if (!hasPublicImport) {
    return `the template must import the "${feature}" public boundary`;
  }
  if (!containsRouteCallWithStaticPath(composed.body)) {
    return 'the template must mount a Feature export with a static .route() path';
  }
  return undefined;
}

function defaultExportedArray(sourceFile: ts.SourceFile): ts.ArrayLiteralExpression | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const unwrapped = unwrapExpression(statement.expression);
      if (ts.isArrayLiteralExpression(unwrapped)) {
        return unwrapped;
      }
      if (ts.isIdentifier(unwrapped)) {
        const resolved = resolveArrayByName(sourceFile, unwrapped.text);
        if (resolved) {
          return resolved;
        }
      }
    }
  }
  return undefined;
}

function resolveArrayByName(sourceFile: ts.SourceFile, name: string): ts.ArrayLiteralExpression | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer
        ) {
          const unwrapped = unwrapExpression(declaration.initializer);
          if (ts.isArrayLiteralExpression(unwrapped)) {
            return unwrapped;
          }
        }
      }
    }
  }
  return undefined;
}

function webRecordHasStaticPath(element: ts.Expression): boolean {
  const unwrapped = unwrapExpression(element);
  if (!ts.isObjectLiteralExpression(unwrapped)) {
    return false;
  }
  for (const property of unwrapped.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) || property.name.text !== 'path') {
      continue;
    }
    if (staticStringOf(property.initializer) !== undefined) {
      return true;
    }
  }
  return false;
}

export function validateWebAssemblyTemplate(source: string, feature: string): string | undefined {
  const sourceFile = ts.createSourceFile('web.ts', source, ts.ScriptTarget.Latest, true);
  if (sourceFileHasSyntaxErrors(sourceFile)) {
    return 'the template does not parse as TypeScript';
  }
  const routes = defaultExportedArray(sourceFile);
  if (!routes) {
    return 'the template must default-export a Vue Router route array';
  }
  const hasWebImport = collectImportSpecifiers(sourceFile).some(
    (specifier) => classifyTemplateSpecifier(specifier, feature) === 'web',
  );
  if (!hasWebImport) {
    return `the template must import the "${feature}" web boundary`;
  }
  if (!routes.elements.some(webRecordHasStaticPath)) {
    return 'the template must contain at least one route record with a static path';
  }
  return undefined;
}

export function validateAssemblyTemplates(
  templates: AssemblyTemplates,
  feature: string,
): string | undefined {
  if (templates.server !== undefined) {
    const problem = validateServerAssemblyTemplate(templates.server, feature);
    if (problem !== undefined) {
      return `Official feature "${feature}" ships a malformed server assembly template: ${problem}.`;
    }
  }
  if (templates.web !== undefined) {
    const problem = validateWebAssemblyTemplate(templates.web, feature);
    if (problem !== undefined) {
      return `Official feature "${feature}" ships a malformed web assembly template: ${problem}.`;
    }
  }
  return undefined;
}

interface TextEdit {
  line: number;
  text: string;
}

function lineOf(position: number, sourceFile: ts.SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line;
}

function leadingWhitespace(line: string): string {
  const match = /^(\s*)/.exec(line);
  return match ? match[1] : '';
}

function applyLineInsertions(source: string, insertions: TextEdit[]): string {
  const lines = source.split('\n');
  const ordered = [...insertions].sort((left, right) => left.line - right.line);
  let offset = 0;
  for (const insertion of ordered) {
    lines.splice(insertion.line + offset, 0, insertion.text);
    offset += 1;
  }
  let content = lines.join('\n');
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  return content;
}

function declaredLocalNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  function visit(node: ts.Node): void {
    if (
      (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      names.add(node.name.text);
    }
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause?.name) {
        names.add(clause.name.text);
      }
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          names.add(element.name.text);
        }
      }
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        names.add(clause.namedBindings.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return names;
}

function lastImportEndLine(sourceFile: ts.SourceFile): number | undefined {
  let last: number | undefined;
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      last = lineOf(statement.getEnd(), sourceFile);
    }
  }
  return last;
}

function honoConstructorNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (statement.moduleSpecifier.text !== 'hono') {
      continue;
    }
    const clause = statement.importClause;
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (element.isTypeOnly) {
          continue;
        }
        const imported = element.propertyName?.text ?? element.name.text;
        if (imported === 'Hono') {
          names.add(element.name.text);
        }
      }
    }
  }
  return names;
}

function provenHonoInstances(sourceFile: ts.SourceFile, constructors: Set<string>): string[] {
  const instances: string[] = [];
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
      if (ts.isIdentifier(constructor) && constructors.has(constructor.text)) {
        instances.push(declaration.name.text);
      }
    }
  }
  return instances;
}

function existingDefaultImportLocal(sourceFile: ts.SourceFile, specifier: string): string | undefined {
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === specifier &&
      statement.importClause?.name
    ) {
      return statement.importClause.name.text;
    }
  }
  return undefined;
}

function callExists(sourceFile: ts.SourceFile, callee: string, firstArgument: string): boolean {
  let found = false;
  function visit(node: ts.Node): void {
    if (found) {
      return;
    }
    if (ts.isCallExpression(node) && node.arguments.length >= 1) {
      const target = unwrapExpression(node.expression);
      const first = unwrapExpression(node.arguments[0]);
      if (
        ts.isIdentifier(target) &&
        target.text === callee &&
        ts.isIdentifier(first) &&
        first.text === firstArgument
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

export interface ServerComposition {
  content: string;
  localName: string;
  honoInstance: string;
}

export function composeServerRoot(source: string, feature: string, localName = serverComposeLocalName(feature)): ServerComposition {
  const sourceFile = ts.createSourceFile(CANONICAL_SERVER_ROOT, source, ts.ScriptTarget.Latest, true);
  if (sourceFileHasSyntaxErrors(sourceFile)) {
    throw new Error(`Cannot compose "${feature}": ${CANONICAL_SERVER_ROOT} does not parse as TypeScript.`);
  }
  const instances = provenHonoInstances(sourceFile, honoConstructorNames(sourceFile));
  if (instances.length === 0) {
    throw new Error(`Cannot compose "${feature}": ${CANONICAL_SERVER_ROOT} does not prove a Hono application instance.`);
  }
  const honoInstance = instances.includes('app') ? 'app' : instances[0];
  const specifier = serverBindingSpecifier(feature);
  const existingLocal = existingDefaultImportLocal(sourceFile, specifier);
  const effectiveLocal = existingLocal ?? localName;
  if (existingLocal === undefined && declaredLocalNames(sourceFile).has(effectiveLocal)) {
    throw new Error(`Cannot compose "${feature}": local name "${effectiveLocal}" is already declared in ${CANONICAL_SERVER_ROOT}.`);
  }
  const insertions: TextEdit[] = [];
  if (existingLocal === undefined) {
    const lastImport = lastImportEndLine(sourceFile);
    if (lastImport === undefined) {
      throw new Error(`Cannot compose "${feature}": ${CANONICAL_SERVER_ROOT} has no import block to extend.`);
    }
    insertions.push({ line: lastImport + 1, text: `import ${effectiveLocal} from '${specifier}';` });
  }
  if (!callExists(sourceFile, effectiveLocal, honoInstance)) {
    const anchor = lastRouteCallLine(sourceFile, honoInstance) ?? declarationLine(sourceFile, honoInstance);
    if (anchor === undefined) {
      throw new Error(`Cannot compose "${feature}": cannot locate the Hono application statement in ${CANONICAL_SERVER_ROOT}.`);
    }
    insertions.push({ line: anchor + 1, text: `${effectiveLocal}(${honoInstance});` });
  }
  if (insertions.length === 0) {
    const normalized = source.endsWith('\n') ? source : `${source}\n`;
    return { content: normalized, localName: effectiveLocal, honoInstance };
  }
  return { content: applyLineInsertions(source, insertions), localName: effectiveLocal, honoInstance };
}

function lastRouteCallLine(sourceFile: ts.SourceFile, instance: string): number | undefined {
  let last: number | undefined;
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isPropertyAccessExpression(statement.expression.expression) &&
      statement.expression.expression.name.text === 'route'
    ) {
      const receiver = unwrapExpression(statement.expression.expression.expression);
      if (ts.isIdentifier(receiver) && receiver.text === instance) {
        last = lineOf(statement.getEnd(), sourceFile);
      }
    }
  }
  return last;
}

function declarationLine(sourceFile: ts.SourceFile, instance: string): number | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === instance) {
        return lineOf(statement.getEnd(), sourceFile);
      }
    }
  }
  return undefined;
}

export interface WebComposition {
  content: string;
  localName: string;
}

export function composeWebRoot(source: string, feature: string, localName = webRoutesLocalName(feature)): WebComposition {
  const sourceFile = ts.createSourceFile(CANONICAL_WEB_ROOT, source, ts.ScriptTarget.Latest, true);
  if (sourceFileHasSyntaxErrors(sourceFile)) {
    throw new Error(`Cannot compose "${feature}": ${CANONICAL_WEB_ROOT} does not parse as TypeScript.`);
  }
  const factories = vueRouterFactoryNames(sourceFile);
  if (factories.size === 0) {
    throw new Error(`Cannot compose "${feature}": ${CANONICAL_WEB_ROOT} does not import createRouter from vue-router.`);
  }
  const routesArray = provenRoutesArray(sourceFile, factories);
  if (!routesArray) {
    throw new Error(`Cannot compose "${feature}": ${CANONICAL_WEB_ROOT} does not prove a static route array.`);
  }
  const specifier = webBindingSpecifier(feature);
  const existingLocal = existingDefaultImportLocal(sourceFile, specifier);
  const effectiveLocal = existingLocal ?? localName;
  if (existingLocal === undefined && declaredLocalNames(sourceFile).has(effectiveLocal)) {
    throw new Error(`Cannot compose "${feature}": local name "${effectiveLocal}" is already declared in ${CANONICAL_WEB_ROOT}.`);
  }
  const insertions: TextEdit[] = [];
  if (existingLocal === undefined) {
    const lastImport = lastImportEndLine(sourceFile);
    if (lastImport === undefined) {
      throw new Error(`Cannot compose "${feature}": ${CANONICAL_WEB_ROOT} has no import block to extend.`);
    }
    insertions.push({ line: lastImport + 1, text: `import ${effectiveLocal} from '${specifier}';` });
  }
  if (!spreadExists(routesArray, effectiveLocal)) {
    insertions.push(spreadInsertion(source, sourceFile, routesArray, effectiveLocal));
  }
  if (insertions.length === 0) {
    const normalized = source.endsWith('\n') ? source : `${source}\n`;
    return { content: normalized, localName: effectiveLocal };
  }
  return { content: applyLineInsertions(source, insertions), localName: effectiveLocal };
}

function vueRouterFactoryNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (statement.moduleSpecifier.text !== 'vue-router') {
      continue;
    }
    const clause = statement.importClause;
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        if (element.isTypeOnly) {
          continue;
        }
        const imported = element.propertyName?.text ?? element.name.text;
        if (imported === 'createRouter') {
          names.add(element.name.text);
        }
      }
    }
  }
  return names;
}

function provenRoutesArray(sourceFile: ts.SourceFile, factories: Set<string>): ts.ArrayLiteralExpression | undefined {
  let found: ts.ArrayLiteralExpression | undefined;
  function visit(node: ts.Node): void {
    if (found) {
      return;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && factories.has(node.expression.text) && node.arguments.length > 0) {
      const options = unwrapExpression(node.arguments[0]);
      if (ts.isObjectLiteralExpression(options)) {
        for (const property of options.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === 'routes'
          ) {
            const resolved = resolveRoutesExpression(sourceFile, unwrapExpression(property.initializer));
            if (resolved) {
              found = resolved;
              return;
            }
          }
          if (
            ts.isShorthandPropertyAssignment(property) &&
            property.name.text === 'routes'
          ) {
            const resolved = resolveArrayByName(sourceFile, 'routes');
            if (resolved) {
              found = resolved;
              return;
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

function resolveRoutesExpression(sourceFile: ts.SourceFile, expression: ts.Expression): ts.ArrayLiteralExpression | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isArrayLiteralExpression(unwrapped)) {
    return unwrapped;
  }
  if (ts.isIdentifier(unwrapped)) {
    return resolveArrayByName(sourceFile, unwrapped.text);
  }
  return undefined;
}

function spreadExists(routes: ts.ArrayLiteralExpression, localName: string): boolean {
  return routes.elements.some(
    (element) =>
      ts.isSpreadElement(element) &&
      ts.isIdentifier(unwrapExpression(element.expression)) &&
      (unwrapExpression(element.expression) as ts.Identifier).text === localName,
  );
}

function catchAllElementLine(sourceFile: ts.SourceFile, routes: ts.ArrayLiteralExpression): number | undefined {
  for (const element of routes.elements) {
    const record = unwrapExpression(element);
    if (!ts.isObjectLiteralExpression(record)) {
      continue;
    }
    for (const property of record.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === 'path'
      ) {
        const value = staticStringOf(property.initializer);
        if (value !== undefined && (value.includes('*') || value.includes(':pathMatch'))) {
          return lineOf(element.getStart(sourceFile), sourceFile);
        }
      }
    }
  }
  return undefined;
}

function spreadInsertion(
  source: string,
  sourceFile: ts.SourceFile,
  routes: ts.ArrayLiteralExpression,
  localName: string,
): TextEdit {
  const lines = source.split('\n');
  const catchAllLine = catchAllElementLine(sourceFile, routes);
  if (catchAllLine !== undefined) {
    return { line: catchAllLine, text: `${leadingWhitespace(lines[catchAllLine] ?? '')}...${localName},` };
  }
  if (routes.elements.length > 0) {
    const lastElement = routes.elements[routes.elements.length - 1];
    const lastLine = lineOf(lastElement.getEnd(), sourceFile);
    return { line: lastLine + 1, text: `${leadingWhitespace(lines[lastLine] ?? '')}...${localName},` };
  }
  const openLine = lineOf(routes.getStart(sourceFile), sourceFile);
  const closeLine = lineOf(routes.getEnd(), sourceFile);
  if (openLine === closeLine) {
    throw new Error('Cannot compose route array: the static route array is empty and inline.');
  }
  const closeIndent = leadingWhitespace(lines[closeLine] ?? '');
  return { line: closeLine, text: `${closeIndent}  ...${localName},` };
}

export interface DefaultComposeFunction {
  param: string;
  body: ts.Node;
}

/**
 * Default-exported composition function with its Hono parameter proven.
 * Installation validation and integration discovery share this shape so both
 * agree on what binding activation means.
 */
export function defaultComposeFunction(sourceFile: ts.SourceFile): DefaultComposeFunction | undefined {
  const composed = defaultExportedFunction(sourceFile);
  if (!composed || composed.parameters.length < 1) {
    return undefined;
  }
  const first = composed.parameters[0].name;
  if (!ts.isIdentifier(first)) {
    return undefined;
  }
  return { param: first.text, body: composed.body };
}

/** Default-exported route array, following a local alias. Shared with discovery. */
export function defaultRouteArray(sourceFile: ts.SourceFile): ts.ArrayLiteralExpression | undefined {
  return defaultExportedArray(sourceFile);
}
