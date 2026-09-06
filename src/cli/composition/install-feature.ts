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
import { analyzeArchitecture, type DoctorIssue } from '../architecture/doctor';
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
  checkAssemblyPrerequisites,
  readFeatureRequirements,
  validateRequirementsAgainstSource,
} from './requirements';
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
  /** npm dependencies added to package.json by this installation. */
  packageDependencies: Array<{ name: string; version: string }>;
}

export interface FeatureInstallError {
  message: string;
  kind:
  | 'invalid-name'
  | 'unknown-feature'
  | 'duplicate'
  | 'invalid-assembly'
  | 'prerequisite'
  | 'requirements'
  | 'package-conflict'
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
  packageJson?: PackageJsonPlan;
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


export interface PackageJsonPlan {
  path: string;
  before: string;
  after: string;
  added: Array<{ name: string; version: string }>;
}

/**
 * Plan deterministic package.json dependency edits for declared
 * requirements. Missing packages are appended in declared order; identical
 * declarations are kept untouched. Any conflicting declaration fails
 * before mutation — compatibility across arbitrary ranges is never
 * guessed. Only `dependencies` participates; the lockfile and the actual
 * install stay with the user's package manager.
 */
export function planPackageJson(
  root: string,
  feature: string,
  packages: Record<string, string>,
): { ok: true; plan: PackageJsonPlan | undefined } | { ok: false; error: FeatureInstallError } {
  const names = Object.keys(packages);
  if (names.length === 0) return { ok: true, plan: undefined };
  const manifestPath = path.resolve(root, 'package.json');
  let before: string;
  try {
    before = readFileSync(manifestPath, 'utf8');
  } catch {
    return {
      ok: false,
      error: {
        kind: 'composition',
        message:
          `Cannot add "${feature}": it requires npm ${names.length === 1 ? 'package' : 'packages'} ` +
          `${names.map((name) => `"${name}"`).join(', ')}, but ${path.relative(root, manifestPath)} does not exist; nothing was installed.`,
      },
    };
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(before);
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'composition',
        message: `Cannot add "${feature}": ${path.relative(root, manifestPath)} is not valid JSON; nothing was installed.`,
      },
    };
  }
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    return {
      ok: false,
      error: {
        kind: 'composition',
        message: `Cannot add "${feature}": ${path.relative(root, manifestPath)} does not hold a JSON object; nothing was installed.`,
      },
    };
  }
  const record = manifest as Record<string, unknown>;
  if (record.dependencies === undefined) {
    record.dependencies = {};
  }
  if (typeof record.dependencies !== 'object' || record.dependencies === null || Array.isArray(record.dependencies)) {
    return {
      ok: false,
      error: {
        kind: 'composition',
        message: `Cannot add "${feature}": ${path.relative(root, manifestPath)} holds a non-object "dependencies" entry; nothing was installed.`,
      },
    };
  }
  const dependencies = record.dependencies as Record<string, unknown>;
  const added: Array<{ name: string; version: string }> = [];
  for (const name of names) {
    const wanted = packages[name];
    const existing = dependencies[name];
    if (existing === undefined) {
      dependencies[name] = wanted;
      added.push({ name, version: wanted });
      continue;
    }
    if (existing !== wanted) {
      return {
        ok: false,
        error: {
          kind: 'package-conflict',
          message:
            `Cannot add "${feature}": ${path.relative(root, manifestPath)} already declares "${name}" as ` +
            `"${String(existing)}", which conflicts with the required "${wanted}". Resolve the version manually; nothing was installed.`,
        },
      };
    }
  }
  if (added.length === 0) return { ok: true, plan: undefined };
  return { ok: true, plan: { path: manifestPath, before, after: `${JSON.stringify(manifest, null, 2)}\n`, added } };
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
    if (plan.packageJson) {
      writeFileAtomically(plan.packageJson.path, plan.packageJson.after);
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
        packageDependencies: plan.packageJson ? [...plan.packageJson.added] : [],
      },
    };
  } catch (error) {
    if (plan.packageJson) {
      try {
        writeFileSync(plan.packageJson.path, plan.packageJson.before);
      } catch {
        // Best-effort restore; the original error below carries the failure.
      }
      rmSync(`${plan.packageJson.path}.nara-add-stage`, { force: true });
    }
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
    const requirementsRead = readFeatureRequirements(source);
    if (!requirementsRead.ok) {
      return { ok: false, error: { kind: 'requirements', message: `${requirementsRead.error}; nothing was installed.` } };
    }
    const requirements = requirementsRead.requirements;
    if (requirements !== undefined) {
      const stale = validateRequirementsAgainstSource(requirements, sourceFiles, templates);
      if (stale !== undefined) {
        return { ok: false, error: { kind: 'requirements', message: `${stale}` } };
      }
    }
    const declaredProviders = requirements?.providers;
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

        const packaged = requirements ? planPackageJson(root, name, requirements.packages) : { ok: true as const, plan: undefined };
        if (!packaged.ok) {
          rmSync(target, { recursive: true, force: true });
          featureInstalled = false;
          rmSync(targetLineage, { recursive: true, force: true });
          lineageInstalled = false;
          return { ok: false, error: packaged.error };
        }
        if (packaged.plan) {
          writeFileAtomically(packaged.plan.path, packaged.plan.after);
        }

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
            packageDependencies: packaged.plan ? [...packaged.plan.added] : [],
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
    const missingPrerequisite = checkAssemblyPrerequisites(root, name, templates, declaredProviders);
    if (missingPrerequisite !== undefined) {
      return { ok: false, error: { kind: 'prerequisite', message: missingPrerequisite } };
    }
    const packaged = requirements ? planPackageJson(root, name, requirements.packages) : { ok: true as const, plan: undefined };
    if (!packaged.ok) {
      return { ok: false, error: packaged.error };
    }
    if (packaged.plan) {
      planned.plan.packageJson = packaged.plan;
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
