import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { analyzeArchitecture, type DoctorIssue } from '../architecture/doctor';
import { discoverExportedNames } from '../architecture/discover-boundary-exports';
import { discoverFeatureIntegrations } from '../architecture/discover-integrations';
import { diagnosticKey } from '../architecture/diff';
import {
  CANONICAL_SERVER_ROOT,
  CANONICAL_WEB_ROOT,
  composeServerRoot,
  composeWebRoot,
  readAssemblyTemplates,
  serverBindingAppFile,
  serverBindingDestination,
  validateAssemblyTemplates,
  webBindingAppFile,
  webBindingDestination,
  type AssemblyTemplates,
} from './assembly';
import { featureNameIsValid } from '../feature-name';
import { resolveOfficialFeatureDirectory } from '../package-root';
import {
  cleanupStagedLineage,
  copyFeatureFiles,
  digestFeatureFiles,
  lineageDirectory,
  readFeatureFiles,
  stageFeatureLineage,
  type StagedLineage,
} from '../evolution/lineage';

export interface InstalledFeature {
  name: string;
  directory: string;
  files: string[];
  lineageDirectory: string;
  baseDigest: string;
  bindings: string[];
  composedRoots: string[];
}

export interface FeatureInstallError {
  message: string;
  kind:
  | 'invalid-name'
  | 'unknown-feature'
  | 'duplicate'
  | 'invalid-assembly'
  | 'prerequisite'
  | 'composition'
  | 'filesystem';
}

export type InstallFeatureResult =
  | { ok: true; feature: InstalledFeature }
  | { ok: false; error: FeatureInstallError };

export interface InstallFeatureOptions {
  /**
   * Override the official package directory. Production use resolves it from
   * the installed CLI; tests point it at an isolated fixture so no fake
   * Feature enters the real catalog.
   */
  officialDirectory?: string;
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

function issueIdentity(issue: DoctorIssue, root: string): string {
  const file = path.isAbsolute(issue.file) ? toPosix(path.relative(root, issue.file)) : toPosix(issue.file);
  return diagnosticKey({ code: issue.code, file, relationship: issue.relationship });
}

interface AssemblyPlan {
  serverBinding?: { destination: string; appFile: string; content: string };
  webBinding?: { destination: string; appFile: string; content: string };
  serverRoot?: { file: string; before: string; after: string };
  webRoot?: { file: string; before: string; after: string };
}

function readTextFile(file: string, feature: string, role: string): { ok: true; content: string } | { ok: false; message: string } {
  try {
    return { ok: true, content: readFileSync(file, 'utf8') };
  } catch {
    return {
      ok: false,
      message: `Cannot compose "${feature}": ${role} at ${file} is missing or unreadable; nothing was installed.`,
    };
  }
}

interface TemplateProviderNeed {
  provider: string;
  boundaryFile: string;
  symbols: string[];
  existenceOnly: boolean;
  templateRole: string;
}

/**
 * Parse one assembly template for imports that name another Feature's public
 * boundary. Templates live in `src/app/bindings/`, so only destination-
 * relative `../../features/<provider>` (or `/web`) specifiers count; every
 * other specifier is ordinary application code, not a provider requirement.
 */
function templateProviderNeeds(source: string, feature: string, templateRole: string): TemplateProviderNeed[] {
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
 */
function checkAssemblyPrerequisites(root: string, feature: string, templates: AssemblyTemplates): string | undefined {
  const needs: TemplateProviderNeed[] = [
    ...(templates.server === undefined ? [] : templateProviderNeeds(templates.server, feature, 'server')),
    ...(templates.web === undefined ? [] : templateProviderNeeds(templates.web, feature, 'web')),
  ];
  for (const need of needs) {
    const boundaryPath = path.resolve(root, need.boundaryFile);
    let exported: string[];
    try {
      exported = discoverExportedNames(boundaryPath);
    } catch {
      return (
        `Cannot add "${feature}": the ${need.templateRole} assembly needs the "${need.provider}" feature, ` +
        `but ${need.boundaryFile} does not exist in this application. Provide "${need.provider}" first; nothing was installed.`
      );
    }
    if (need.existenceOnly) continue;
    const missing = need.symbols.filter((symbol) => !exported.includes(symbol));
    if (missing.length > 0) {
      return (
        `Cannot add "${feature}": the ${need.templateRole} assembly needs ${missing.map((symbol) => `"${symbol}"`).join(', ')} ` +
        `from the "${need.provider}" feature, but ${need.boundaryFile} does not export them. Provide a compatible "${need.provider}" first; nothing was installed.`
      );
    }
  }
  return undefined;
}

/**
 * Replace a canonical composition root through a stage file. The stage file
 * is always removed when staging or the rename fails, so a failed
 * composition never leaves temporary canonical-root artifacts behind.
 */
export function writeFileAtomically(destination: string, content: string): void {
  const stageFile = `${destination}.nara-add-stage`;
  writeFileSync(stageFile, content);
  try {
    renameSync(stageFile, destination);
  } catch (error) {
    rmSync(stageFile, { force: true });
    throw error;
  }
}

function planAssembly(
  root: string,
  feature: string,
  templates: AssemblyTemplates,
): { ok: true; plan: AssemblyPlan } | { ok: false; error: FeatureInstallError } {
  const malformed = validateAssemblyTemplates(templates, feature);
  if (malformed !== undefined) {
    return { ok: false, error: { kind: 'invalid-assembly', message: `${malformed} Nothing was installed.` } };
  }
  const plan: AssemblyPlan = {};
  if (templates.server !== undefined) {
    const destination = serverBindingDestination(root, feature);
    if (existsSync(destination)) {
      return {
        ok: false,
        error: {
          kind: 'duplicate',
          message: `Application binding already exists at ${destination}; nothing was overwritten.`,
        },
      };
    }
    plan.serverBinding = { destination, appFile: serverBindingAppFile(feature), content: templates.server };
    const serverFile = path.resolve(root, CANONICAL_SERVER_ROOT);
    const before = readTextFile(serverFile, feature, 'The canonical server composition root');
    if (!before.ok) {
      return { ok: false, error: { kind: 'composition', message: before.message } };
    }
    try {
      const composed = composeServerRoot(before.content, feature);
      plan.serverRoot = { file: serverFile, before: before.content, after: composed.content };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: 'composition',
          message: `${error instanceof Error ? error.message : String(error)} Nothing was installed.`,
        },
      };
    }
  }
  if (templates.web !== undefined) {
    const destination = webBindingDestination(root, feature);
    if (existsSync(destination)) {
      return {
        ok: false,
        error: {
          kind: 'duplicate',
          message: `Application binding already exists at ${destination}; nothing was overwritten.`,
        },
      };
    }
    plan.webBinding = { destination, appFile: webBindingAppFile(feature), content: templates.web };
    const routerFile = path.resolve(root, CANONICAL_WEB_ROOT);
    const before = readTextFile(routerFile, feature, 'The canonical web composition root');
    if (!before.ok) {
      return { ok: false, error: { kind: 'composition', message: before.message } };
    }
    try {
      const composed = composeWebRoot(before.content, feature);
      plan.webRoot = { file: routerFile, before: before.content, after: composed.content };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: 'composition',
          message: `${error instanceof Error ? error.message : String(error)} Nothing was installed.`,
        },
      };
    }
  }
  return { ok: true, plan };
}

function writeCandidateTree(
  candidateRoot: string,
  root: string,
  feature: string,
  sourceFiles: ReadonlyMap<string, Buffer>,
  plan: AssemblyPlan,
): void {
  const sourceRoot = path.join(root, 'src');
  const candidateSourceRoot = path.join(candidateRoot, 'src');
  if (existsSync(sourceRoot)) {
    cpSync(sourceRoot, candidateSourceRoot, { recursive: true });
  } else {
    mkdirSync(candidateSourceRoot, { recursive: true });
  }
  copyFeatureFiles(sourceFiles, path.join(candidateSourceRoot, 'features', feature));
  if (plan.serverBinding) {
    const file = path.join(candidateRoot, ...plan.serverBinding.appFile.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, plan.serverBinding.content);
  }
  if (plan.webBinding) {
    const file = path.join(candidateRoot, ...plan.webBinding.appFile.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, plan.webBinding.content);
  }
  if (plan.serverRoot) {
    writeFileSync(path.join(candidateRoot, CANONICAL_SERVER_ROOT), plan.serverRoot.after);
  }
  if (plan.webRoot) {
    writeFileSync(path.join(candidateRoot, CANONICAL_WEB_ROOT), plan.webRoot.after);
  }
}

function validateAssemblyCandidate(
  root: string,
  feature: string,
  sourceFiles: ReadonlyMap<string, Buffer>,
  plan: AssemblyPlan,
): string | undefined {
  const candidateRoot = mkdtempSync(path.join(os.tmpdir(), 'nara-add-candidate-'));
  try {
    writeCandidateTree(candidateRoot, root, feature, sourceFiles, plan);
    const currentIssues = new Set(analyzeArchitecture(root).issues.map((issue) => issueIdentity(issue, root)));
    const candidateIssues = analyzeArchitecture(candidateRoot).issues;
    const introduced = candidateIssues.filter((issue) => !currentIssues.has(issueIdentity(issue, candidateRoot)));
    if (introduced.length > 0) {
      const first = introduced
        .map((issue) => `[${issue.code}] ${issue.file}: ${issue.message}`)
        .sort()[0];
      return (
        `Cannot compose "${feature}": the assembly introduces a new architecture diagnostic: ${first}. ` +
        `Resolve the composition or the diagnostic first; nothing was installed.`
      );
    }
    const integrations = discoverFeatureIntegrations(candidateRoot)[feature];
    if (plan.serverBinding) {
      const bindingImport = integrations?.applicationImports.some(
        (fact) => fact.appFile === plan.serverBinding?.appFile && fact.boundary === 'public',
      );
      const serverRoute = integrations?.serverRoutes.some((route) => route.appFile === CANONICAL_SERVER_ROOT);
      if (!bindingImport || !serverRoute) {
        return (
          `Cannot compose "${feature}": Nara cannot prove the server assembly ` +
          `(${plan.serverBinding.appFile} mounting a public export at a static path and activated from ${CANONICAL_SERVER_ROOT}). ` +
          `Nothing was installed.`
        );
      }
    }
    if (plan.webBinding) {
      const bindingImport = integrations?.applicationImports.some(
        (fact) => fact.appFile === plan.webBinding?.appFile && fact.boundary === 'web',
      );
      const webRoute = integrations?.webRoutes.some((route) => route.appFile === CANONICAL_WEB_ROOT);
      if (!bindingImport || !webRoute) {
        return (
          `Cannot compose "${feature}": Nara cannot prove the web assembly ` +
          `(${plan.webBinding.appFile} spread into ${CANONICAL_WEB_ROOT}). Nothing was installed.`
        );
      }
    }
    return undefined;
  } finally {
    rmSync(candidateRoot, { recursive: true, force: true });
  }
}

function applyAssemblyTransaction(
  root: string,
  feature: string,
  sourceFiles: ReadonlyMap<string, Buffer>,
  baseDigest: string,
  plan: AssemblyPlan,
  target: string,
  targetLineage: string,
): { feature: InstalledFeature } {
  const featuresDirectory = path.dirname(target);
  mkdirSync(featuresDirectory, { recursive: true });
  const featureStage = mkdtempSync(path.join(featuresDirectory, '.nara-feature-'));
  let stagedLineage: StagedLineage | undefined;
  let featureInstalled = false;
  let lineageInstalled = false;
  const writtenBindings: string[] = [];
  const writtenRoots: string[] = [];
  const rootBackups = new Map<string, string>();
  try {
    copyFeatureFiles(sourceFiles, featureStage);
    stagedLineage = stageFeatureLineage(root, feature, sourceFiles, baseDigest);
    if (existsSync(target)) {
      throw new Error(`Feature "${feature}" already exists at ${target}; nothing was overwritten.`);
    }
    if (existsSync(targetLineage)) {
      throw new Error(`Lineage already exists at ${targetLineage}.`);
    }
    for (const binding of [plan.serverBinding, plan.webBinding]) {
      if (binding && existsSync(binding.destination)) {
        throw new Error(`Application binding already exists at ${binding.destination}; nothing was overwritten.`);
      }
    }
    for (const composition of [plan.serverRoot, plan.webRoot]) {
      if (composition && readFileSync(composition.file, 'utf8') !== composition.before) {
        throw new Error(`Canonical composition root changed during installation at ${composition.file}; nothing was applied.`);
      }
    }
    renameSync(featureStage, target);
    featureInstalled = true;
    renameSync(stagedLineage.directory, targetLineage);
    lineageInstalled = true;
    stagedLineage = undefined;
    for (const binding of [plan.serverBinding, plan.webBinding]) {
      if (!binding) {
        continue;
      }
      mkdirSync(path.dirname(binding.destination), { recursive: true });
      writeFileSync(binding.destination, binding.content, { flag: 'wx' });
      writtenBindings.push(binding.destination);
    }
    for (const composition of [plan.serverRoot, plan.webRoot]) {
      if (!composition) {
        continue;
      }
      rootBackups.set(composition.file, composition.before);
      writeFileAtomically(composition.file, composition.after);
      writtenRoots.push(composition.file);
    }
    return {
      feature: {
        name: feature,
        directory: target,
        files: [...sourceFiles.keys()].map((file) => path.join(target, ...file.split('/'))),
        lineageDirectory: targetLineage,
        baseDigest,
        bindings: [...writtenBindings].sort(),
        composedRoots: [...writtenRoots].sort(),
      },
    };
  } catch (error) {
    for (const [file, before] of rootBackups) {
      try {
        writeFileSync(file, before);
      } catch {
        // Best-effort restore; the original error below carries the failure.
      }
    }
    for (const composition of [plan.serverRoot, plan.webRoot]) {
      if (composition) rmSync(`${composition.file}.nara-add-stage`, { force: true });
    }
    for (const binding of writtenBindings) {
      rmSync(binding, { force: true });
    }
    if (featureInstalled) rmSync(target, { recursive: true, force: true });
    if (lineageInstalled) rmSync(targetLineage, { recursive: true, force: true });
    rmSync(featureStage, { recursive: true, force: true });
    cleanupStagedLineage(stagedLineage);
    throw error;
  }
}

function isDuplicateMessage(message: string): boolean {
  return message.includes('already exists');
}

export function installOfficialFeature(
  name: string,
  root = process.cwd(),
  options: InstallFeatureOptions = {},
): InstallFeatureResult {
  if (!featureNameIsValid(name)) {
    return {
      ok: false,
      error: {
        kind: 'invalid-name',
        message: `Invalid feature name "${name}". Use lowercase letters, numbers, and single hyphens; start with a letter.`,
      },
    };
  }

  const source = options.officialDirectory ?? resolveOfficialFeatureDirectory(name);
  const featuresDirectory = path.resolve(root, 'src', 'features');
  const target = path.resolve(featuresDirectory, name);
  const targetLineage = lineageDirectory(root, name);
  try {
    if (!existsSync(source) || !statSync(source).isDirectory()) {
      return {
        ok: false,
        error: {
          kind: 'unknown-feature',
          message: `No official feature package named "${name}" was found.`,
        },
      };
    }

    if (existsSync(target)) {
      return {
        ok: false,
        error: {
          kind: 'duplicate',
          message: `Feature "${name}" already exists at ${target}; nothing was overwritten.`,
        },
      };
    }
    if (existsSync(targetLineage)) {
      return {
        ok: false,
        error: {
          kind: 'filesystem',
          message: `Lineage already exists without an installed Feature at ${targetLineage}; installation was refused.`,
        },
      };
    }

    const sourceFiles = readFeatureFiles(source, false);
    if (sourceFiles.size === 0) {
      return {
        ok: false,
        error: {
          kind: 'filesystem',
          message: `Official feature package "${name}" is empty.`,
        },
      };
    }
    const baseDigest = digestFeatureFiles(sourceFiles);
    const templates = readAssemblyTemplates(source);
    if (templates.server === undefined && templates.web === undefined) {
      mkdirSync(featuresDirectory, { recursive: true });
      const featureStage = mkdtempSync(path.join(featuresDirectory, '.nara-feature-'));
      let stagedLineage: StagedLineage | undefined;
      let featureInstalled = false;
      let lineageInstalled = false;
      try {
        copyFeatureFiles(sourceFiles, featureStage);
        stagedLineage = stageFeatureLineage(root, name, sourceFiles, baseDigest);

        if (existsSync(target)) {
          rmSync(featureStage, { recursive: true, force: true });
          cleanupStagedLineage(stagedLineage);
          return {
            ok: false,
            error: {
              kind: 'duplicate',
              message: `Feature "${name}" already exists at ${target}; nothing was overwritten.`,
            },
          };
        }
        if (existsSync(targetLineage)) {
          throw new Error(`Lineage already exists at ${targetLineage}.`);
        }

        renameSync(featureStage, target);
        featureInstalled = true;
        renameSync(stagedLineage.directory, targetLineage);
        lineageInstalled = true;
        stagedLineage = undefined;

        return {
          ok: true,
          feature: {
            name,
            directory: target,
            files: [...sourceFiles.keys()].map((file) => path.join(target, ...file.split('/'))),
            lineageDirectory: targetLineage,
            baseDigest,
            bindings: [],
            composedRoots: [],
          },
        };
      } catch (error) {
        if (featureInstalled) rmSync(target, { recursive: true, force: true });
        if (lineageInstalled) rmSync(targetLineage, { recursive: true, force: true });
        rmSync(featureStage, { recursive: true, force: true });
        cleanupStagedLineage(stagedLineage);
        throw error;
      }
    }

    const planned = planAssembly(root, name, templates);
    if (!planned.ok) {
      return { ok: false, error: planned.error };
    }
    const missingPrerequisite = checkAssemblyPrerequisites(root, name, templates);
    if (missingPrerequisite !== undefined) {
      return { ok: false, error: { kind: 'prerequisite', message: missingPrerequisite } };
    }
    const blocked = validateAssemblyCandidate(root, name, sourceFiles, planned.plan);
    if (blocked !== undefined) {
      return { ok: false, error: { kind: 'composition', message: blocked } };
    }
    try {
      return { ok: true, ...applyAssemblyTransaction(root, name, sourceFiles, baseDigest, planned.plan, target, targetLineage) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isDuplicateMessage(message)) {
        return { ok: false, error: { kind: 'duplicate', message } };
      }
      throw error;
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'filesystem',
        message: `Could not install feature "${name}": ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}
