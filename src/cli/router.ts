import { analyzeArchitecture } from './architecture/doctor';
import path from 'node:path';
import { buildFeatureContext, buildFeatureContextForFile } from './architecture/context';
import type { ArchitectureContextPack, FeatureContextResult } from './architecture/context';
import { inspectFeatureImpact } from './architecture/impact';
import type { FeatureImpact } from './architecture/impact';
import { inspectFeature } from './architecture/inspect';
import type { FeatureInspection } from './architecture/inspect';
import type { FeatureIntegrationFacts } from './architecture/discover-integrations';
import type { FeatureImportEvidence } from './architecture/discover-import-evidence';
import { installOfficialFeature } from './composition/install-feature';
import { formatDiffHuman, runArchitectureDiff } from './commands/diff';
import { formatGuardHuman, runArchitectureGuard } from './commands/guard';
import { makeFeature } from './commands/make-feature';
import { newProject } from './commands/new-project';
export interface CliIO {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface CliOptions {
  cwd?: string;
}

export interface CliResult {
  exitCode: number;
}

const HELP_TEXT = `Nara v3 CLI

Usage:
  nara <command> [options]

  help                      Show this help message
  new <name>                Create a runnable Nara application
  make feature <name>       Create a feature using the canonical structure
  doctor [--json]           Validate feature architecture
  inspect <feature> [--json] Describe one feature
  context <feature> [--json] Prepare an Architecture Context Pack before editing a feature
  impact <feature> [--json] Show known downstream feature impact
  diff --base <ref> [--head <ref>] [--json]
                            Show deterministic Feature-architecture changes
  guard --base <ref> [--head <ref>] [--json]
                            Fail when the change introduces new architecture violations
  add <feature>             Install an official open-code feature

Options:
  -h, --help                Show this help message
`;

const MAKE_FEATURE_HELP = `Usage:
  nara make feature <name>

Creates src/features/<name>/index.ts and contract.ts without overwriting an existing feature.
`;

const NEW_HELP = `Usage:
  nara new <name>

Creates a runnable Nara v3 application without overwriting an existing directory.
`;

const DOCTOR_HELP = `Usage:
  nara doctor [--json]

Checks feature shape, public boundaries, dependency cycles, and server/client boundaries. --json emits the same report as stable JSON.
`;

const INSPECT_HELP = `Usage:
  nara inspect <feature> [--json]

Describes one feature's public interface, dependencies, entrypoints, application integration, contracts, and tests.
`;

const CONTEXT_HELP = `Usage:
  nara context <feature> [--json]
  nara context --file <path> [--json]

Builds a deterministic Architecture Context Pack for humans and coding agents
before they modify a Feature: ownership, public API, relationships, surfaces,
application integration, constraints, Feature-local diagnostics, and a reading
order. Never dumps source.
`;

const IMPACT_HELP = `Usage:
  nara impact <feature> [--json]

Shows direct and transitive dependents from the known feature dependency graph.
`;

const DIFF_HELP = `Usage:
  nara diff --base <ref> [--head <ref>] [--json]

Shows deterministic Feature-architecture changes between a Git base ref and
the working tree (default) or an explicit head ref. git diff explains text
changes; nara diff explains Feature-architecture changes, including canonical
application imports and static server/web routes. Affected output is
structural dependency impact, not semantic behavior prediction. No AI provider
is required.
`;

const GUARD_HELP = `Usage:
  nara guard --base <ref> [--head <ref>] [--json]

Compares a Git base ref against the working tree (default) or an explicit
head ref and fails when the target introduces new nara doctor diagnostics
that did not exist in the base. Existing baseline violations do not fail
the guard; resolved violations are reported. Affected output is structural
dependency impact, not semantic behavior prediction. No AI provider is
required.
`;

const ADD_HELP = `Usage:
  nara add <feature>

Installs an official feature into src/features/<feature> without merging or overwriting local source.
`;

const defaultIO: CliIO = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
};

function generationExitCode(kind: 'invalid-name' | 'unknown-feature' | 'duplicate' | 'filesystem'): number {
  return kind === 'invalid-name' || kind === 'unknown-feature' ? 64 : 73;
}

function renderDoctorReport(io: CliIO, root: string | undefined, json = false): number {
  try {
    const report = analyzeArchitecture(root);
    if (json) {
      io.stdout(`${JSON.stringify(report, null, 2)}\n`);
      return report.healthy ? 0 : 1;
    }
    if (report.healthy) {
      io.stdout('Architecture looks healthy.\n');
      return 0;
    }

    io.stdout(`Found ${report.issues.length} architecture issue${report.issues.length === 1 ? '' : 's'}.\n`);
    for (const issue of report.issues) {
      io.stdout(`- [${issue.code}] ${issue.message}\n`);
      io.stdout(`  file: ${issue.file}\n`);
      io.stdout(`  relationship: ${issue.relationship}\n`);
      io.stdout(`  reason: ${issue.reason}\n`);
      io.stdout(`  fix: ${issue.suggestion}\n`);
    }
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      io.stdout(`${JSON.stringify({ healthy: false, issues: [], error: message }, null, 2)}\n`);
    } else {
      io.stderr(`Could not inspect architecture: ${message}\n`);
    }
    return 73;
  }
}

function renderFeatureList(io: CliIO, label: string, values: string[]): void {
  io.stdout(`${label}:\n`);
  if (values.length === 0) {
    io.stdout('- none\n');
    return;
  }
  for (const value of values) {
    io.stdout(`- ${value}\n`);
  }
}

function renderFeatureIntegration(io: CliIO, integrations: FeatureIntegrationFacts): void {
  const serverRoutes = integrations.serverRoutes.map((route) => `${route.mountPath} via ${route.exportName}`);
  const webRoutes = integrations.webRoutes.map(
    (route) => `${route.path} via ${route.exportName}${route.name === undefined ? '' : ` (name: ${route.name})`}`,
  );
  const consumers = new Map<string, Set<string>>();
  for (const fact of integrations.applicationImports) {
    const symbols = consumers.get(fact.appFile) ?? new Set<string>();
    const importedSymbols = fact.symbols.length > 0 ? fact.symbols : ['(side-effect)'];
    for (const symbol of importedSymbols) {
      symbols.add(`${fact.boundary}: ${symbol}`);
    }
    consumers.set(fact.appFile, symbols);
  }

  renderFeatureList(io, 'Server routes', serverRoutes);
  renderFeatureList(io, 'Web routes', webRoutes);
  renderFeatureList(
    io,
    'Application consumers',
    [...consumers.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([appFile, symbols]) => `${appFile}: ${[...symbols].sort().join(', ')}`),
  );
}
function renderConsumerEvidence(
  io: CliIO,
  title: string,
  evidence: FeatureImportEvidence[],
  boundary: 'public' | 'web',
): void {
  io.stdout(`${title}:\n`);
  const bySymbol = new Map<string, FeatureImportEvidence[]>();
  for (const current of evidence) {
    if (current.boundary !== boundary || current.precision !== 'symbol' || !current.importedSymbol) {
      continue;
    }
    const entries = bySymbol.get(current.importedSymbol) ?? [];
    entries.push(current);
    bySymbol.set(current.importedSymbol, entries);
  }
  if (bySymbol.size === 0) {
    io.stdout('- none\n');
    return;
  }
  for (const [symbol, entries] of [...bySymbol.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    io.stdout(`- ${symbol}\n`);
    for (const entry of entries.sort(
      (left, right) =>
        left.from.localeCompare(right.from) ||
        left.sourceFile.localeCompare(right.sourceFile) ||
        Number(left.typeOnly) - Number(right.typeOnly),
    )) {
      io.stdout(`  - ${entry.from} — ${entry.sourceFile} [${entry.typeOnly ? 'type' : 'value'}]\n`);
    }
  }
}


function renderApplicationIntegration(io: CliIO, integrations: FeatureIntegrationFacts): void {
  io.stdout('Application integration:\n');
  renderFeatureIntegration(io, integrations);
}

function renderFeatureInspection(io: CliIO, feature: FeatureInspection): void {
  io.stdout(`Feature: ${feature.name}\n`);
  io.stdout(`Path: ${feature.path}\n\n`);
  renderFeatureList(io, 'Public exports', feature.publicExports);
  renderFeatureList(io, 'Web public exports', feature.webPublicExports);
  renderFeatureList(io, 'Dependencies', feature.dependencies);
  renderFeatureList(io, 'Dependents', feature.dependents);
  renderFeatureList(io, 'Server', feature.serverEntrypoints);
  renderFeatureList(io, 'Web', feature.webEntrypoints);
  renderFeatureList(io, 'Contracts', feature.contracts);
  renderFeatureList(io, 'Tests', feature.tests);
  io.stdout('\n');
  renderApplicationIntegration(io, feature.integrations);
  renderConsumerEvidence(io, 'Public API consumers', feature.consumerEvidence, 'public');
  renderConsumerEvidence(io, 'Web boundary consumers', feature.consumerEvidence, 'web');
}


function renderInspectReport(io: CliIO, name: string, root: string | undefined, json = false): number {
  try {
    const result = inspectFeature(name, root);
    if (!result.ok) {
      if (json) {
        io.stdout(`${JSON.stringify({ error: result.message }, null, 2)}\n`);
      } else {
        io.stderr(`${result.message}\n`);
      }
      return 1;
    }
    if (json) {
      io.stdout(`${JSON.stringify(result.feature, null, 2)}\n`);
    } else {
      renderFeatureInspection(io, result.feature);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      io.stdout(`${JSON.stringify({ error: message }, null, 2)}\n`);
    } else {
      io.stderr(`Could not inspect feature "${name}": ${message}\n`);
    }
    return 73;
  }
}
function renderContextPack(io: CliIO, context: ArchitectureContextPack): void {
  io.stdout(`Feature context: ${context.target.feature}\n`);
  io.stdout(`Selected by: ${context.target.selectedBy}\n`);
  if (context.target.selectedBy === 'file' && context.target.sourceFile) {
    io.stdout(`Source file: ${context.target.sourceFile}\n`);
  }
  io.stdout(`Work in: ${context.ownership.directory}\n`);
  io.stdout(`Public boundary: ${context.ownership.publicBoundary}\n\n`);
  renderFeatureList(io, 'Public API', context.publicApi.exports);
  renderFeatureList(io, 'Web public API', context.publicApi.webExports);
  renderFeatureList(io, 'Contracts', context.publicApi.contracts);
  renderFeatureList(io, 'Depends on', context.relationships.dependencies);
  renderFeatureList(io, 'Affected dependents', [
    ...context.relationships.directDependents,
    ...context.relationships.transitiveDependents,
  ]);
  io.stdout('\n');
  renderApplicationIntegration(io, context.integrations);
  renderConsumerEvidence(io, 'Public API consumers', context.consumers, 'public');
  renderConsumerEvidence(io, 'Web boundary consumers', context.consumers, 'web');
  renderFeatureList(
    io,
    'Architecture constraints',
    context.constraints.map((constraint) => constraint.description),
  );
  if (context.diagnostics.length === 0) {
    renderFeatureList(io, 'Current architecture issues', []);
  } else {
    renderFeatureList(
      io,
      'Current architecture issues',
      context.diagnostics.map((issue) => `[${issue.code}] ${issue.file}: ${issue.message}`),
    );
  }
  io.stdout('Read first:\n');
  if (context.readingOrder.length === 0) {
    io.stdout('- none\n');
    return;
  }
  context.readingOrder.forEach((entry, index) => {
    io.stdout(`${index + 1}. ${entry.path} — ${entry.reason}\n`);
  });
}

function emitContextResult(io: CliIO, result: FeatureContextResult, json: boolean): number {
  if (!result.ok) {
    if (json) {
      io.stdout(`${JSON.stringify({ error: result.message }, null, 2)}\n`);
    } else {
      io.stderr(`${result.message}\n`);
    }
    return 1;
  }
  if (json) {
    io.stdout(`${JSON.stringify(result.context, null, 2)}\n`);
  } else {
    renderContextPack(io, result.context);
  }
  return 0;
}

function renderContextReport(io: CliIO, args: string[], root: string | undefined): number {
  const json = args.includes('--json');
  const positional = args.filter((arg) => arg !== '--json');
  try {
    if (positional.length === 2 && positional[0] === '--file' && positional[1].length > 0) {
      return emitContextResult(io, buildFeatureContextForFile(positional[1], root), json);
    }
    if (positional.length === 1 && positional[0].length > 0 && positional[0] !== '--file') {
      return emitContextResult(io, buildFeatureContext(positional[0], root), json);
    }
    io.stderr(CONTEXT_HELP);
    return 64;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      io.stdout(`${JSON.stringify({ error: message }, null, 2)}\n`);
    } else {
      io.stderr(`Could not build context: ${message}\n`);
    }
    return 73;
  }
}

function renderFeatureImpact(io: CliIO, impact: FeatureImpact): void {
  io.stdout(`Feature impact: ${impact.name}\n`);
  renderFeatureList(io, 'Direct dependents', impact.directDependents);
  renderFeatureList(io, 'Transitive dependents', impact.transitiveDependents);
  io.stdout('Direct consumer evidence:\n');
  const byDependent = new Map<string, FeatureImportEvidence[]>();
  for (const evidence of impact.directConsumerEvidence) {
    const entries = byDependent.get(evidence.from) ?? [];
    entries.push(evidence);
    byDependent.set(evidence.from, entries);
  }
  if (byDependent.size === 0) {
    io.stdout('- none\n');
  } else {
    for (const [dependent, entries] of [...byDependent.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      io.stdout(`- ${dependent}\n`);
      for (const entry of entries.sort(
        (left, right) =>
          (left.importedSymbol ?? '').localeCompare(right.importedSymbol ?? '') ||
          left.sourceFile.localeCompare(right.sourceFile) ||
          Number(left.typeOnly) - Number(right.typeOnly),
      )) {
        io.stdout(
          `  - ${entry.importedSymbol} — ${entry.sourceFile} [${entry.typeOnly ? 'type' : 'value'}]\n`,
        );
      }
    }
  }
  io.stdout(`Scope: ${impact.scope}; this is a feature-graph relationship, not semantic impact.\n`);
}

function renderImpactReport(io: CliIO, name: string, root: string | undefined, json = false): number {
  try {
    const result = inspectFeatureImpact(name, root);
    if (!result.ok) {
      if (json) {
        io.stdout(`${JSON.stringify({ error: result.message }, null, 2)}\n`);
      } else {
        io.stderr(`${result.message}\n`);
      }
      return 1;
    }
    if (json) {
      io.stdout(`${JSON.stringify(result.impact, null, 2)}\n`);
    } else {
      renderFeatureImpact(io, result.impact);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      io.stdout(`${JSON.stringify({ error: message }, null, 2)}\n`);
    } else {
      io.stderr(`Could not inspect impact for "${name}": ${message}\n`);
    }
    return 73;
  }
}

function parseDiffArgs(args: string[]):
  | { ok: true; base: string; head?: string; json: boolean }
  | { ok: false } {
  let base: string | undefined;
  let head: string | undefined;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--base' || arg === '--head') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) return { ok: false };
      if (arg === '--base') {
        if (base !== undefined) return { ok: false };
        base = value;
      } else {
        if (head !== undefined) return { ok: false };
        head = value;
      }
      index += 1;
    } else if (arg.startsWith('--base=')) {
      if (base !== undefined) return { ok: false };
      const value = arg.slice('--base='.length);
      if (!value) return { ok: false };
      base = value;
    } else if (arg.startsWith('--head=')) {
      if (head !== undefined) return { ok: false };
      const value = arg.slice('--head='.length);
      if (!value) return { ok: false };
      head = value;
    } else {
      return { ok: false };
    }
  }
  if (!base) return { ok: false };
  return { ok: true, base, head, json };
}

function renderDiffReport(io: CliIO, args: string[], root: string | undefined): number {
  if (args.includes('--help') || args.includes('-h')) {
    io.stdout(DIFF_HELP);
    return 0;
  }
  const parsed = parseDiffArgs(args);
  if (!parsed.ok) {
    io.stderr(DIFF_HELP);
    return 64;
  }
  try {
    const result = runArchitectureDiff({ base: parsed.base, head: parsed.head, cwd: root });
    if (parsed.json) {
      io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      io.stdout(formatDiffHuman(result));
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n`);
    return 1;
  }
}

function parseGuardArgs(args: string[]):
  | { ok: true; base: string; head?: string; json: boolean }
  | { ok: false } {
  let base: string | undefined;
  let head: string | undefined;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--base' || arg === '--head') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) return { ok: false };
      if (arg === '--base') {
        if (base !== undefined) return { ok: false };
        base = value;
      } else {
        if (head !== undefined) return { ok: false };
        head = value;
      }
      index += 1;
    } else if (arg.startsWith('--base=')) {
      if (base !== undefined) return { ok: false };
      const value = arg.slice('--base='.length);
      if (!value) return { ok: false };
      base = value;
    } else if (arg.startsWith('--head=')) {
      if (head !== undefined) return { ok: false };
      const value = arg.slice('--head='.length);
      if (!value) return { ok: false };
      head = value;
    } else {
      return { ok: false };
    }
  }
  if (!base) return { ok: false };
  return { ok: true, base, head, json };
}

function renderGuardReport(io: CliIO, args: string[], root: string | undefined): number {
  if (args.includes('--help') || args.includes('-h')) {
    io.stdout(GUARD_HELP);
    return 0;
  }
  const parsed = parseGuardArgs(args);
  if (!parsed.ok) {
    io.stderr(GUARD_HELP);
    return 64;
  }
  try {
    const result = runArchitectureGuard({ base: parsed.base, head: parsed.head, cwd: root });
    if (parsed.json) {
      io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      io.stdout(formatGuardHuman(result));
    }
    return result.passed ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`${message}\n`);
    return 1;
  }
}

export function runCli(argv: string[], io: CliIO = defaultIO, options: CliOptions = {}): CliResult {
  const [command, ...args] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    io.stdout(HELP_TEXT);
    return { exitCode: 0 };
  }

  if (command === 'doctor') {
    if (args.length > 0) {
      if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
        io.stdout(DOCTOR_HELP);
        return { exitCode: 0 };
      }
      if (args.length === 1 && args[0] === '--json') {
        return { exitCode: renderDoctorReport(io, options.cwd, true) };
      }
      io.stderr(DOCTOR_HELP);
      return { exitCode: 64 };
    }
    return { exitCode: renderDoctorReport(io, options.cwd) };
  }

  if (command === 'inspect') {
    const [name, format, ...extraArgs] = args;
    if (name === '--help' || name === '-h') {
      io.stdout(INSPECT_HELP);
      return { exitCode: 0 };
    }
    if (!name || name === '--json' || (format && format !== '--json') || extraArgs.length > 0) {
      io.stderr(INSPECT_HELP);
      return { exitCode: 64 };
    }
    return { exitCode: renderInspectReport(io, name, options.cwd, format === '--json') };
  }

  if (command === 'context') {
    if (args.includes('--help') || args.includes('-h')) {
      const positional = args.filter((arg) => arg !== '--json' && arg !== '--help' && arg !== '-h');
      if (positional.length === 0) {
        io.stdout(CONTEXT_HELP);
        return { exitCode: 0 };
      }
      io.stderr(CONTEXT_HELP);
      return { exitCode: 64 };
    }
    return { exitCode: renderContextReport(io, args, options.cwd) };
  }

  if (command === 'impact') {
    const [name, format, ...extraArgs] = args;
    if (name === '--help' || name === '-h') {
      io.stdout(IMPACT_HELP);
      return { exitCode: 0 };
    }
    if (!name || name === '--json' || (format && format !== '--json') || extraArgs.length > 0) {
      io.stderr(IMPACT_HELP);
      return { exitCode: 64 };
    }
    return { exitCode: renderImpactReport(io, name, options.cwd, format === '--json') };
  }

  if (command === 'diff') {
    return { exitCode: renderDiffReport(io, args, options.cwd) };
  }

  if (command === 'guard') {
    return { exitCode: renderGuardReport(io, args, options.cwd) };
  }

  if (command === 'add') {
    const [name, ...extraArgs] = args;
    if (name === '--help' || name === '-h') {
      io.stdout(ADD_HELP);
      return { exitCode: 0 };
    }
    if (!name || extraArgs.length > 0) {
      io.stderr(ADD_HELP);
      return { exitCode: 64 };
    }

    const result = installOfficialFeature(name, options.cwd);
    if (!result.ok) {
      io.stderr(`${result.error.message}\n`);
      return { exitCode: generationExitCode(result.error.kind) };
    }

    const root = options.cwd ?? process.cwd();
    io.stdout(`Installed feature "${name}":\n`);
    for (const file of result.feature.files) {
      io.stdout(`- ${path.relative(root, file)}\n`);
    }
    return { exitCode: 0 };
  }

  if (command === 'new') {
    const [name, ...extraArgs] = args;
    if (name === '--help' || name === '-h') {
      io.stdout(NEW_HELP);
      return { exitCode: 0 };
    }
    if (!name || extraArgs.length > 0) {
      io.stderr(NEW_HELP);
      return { exitCode: 64 };
    }

    const result = newProject(name, options.cwd);
    if (!result.ok) {
      io.stderr(`${result.error.message}\n`);
      return { exitCode: generationExitCode(result.error.kind) };
    }

    io.stdout(`Created project "${name}" at ${result.project.directory}.\n`);
    return { exitCode: 0 };
  }

  if (command === 'make') {
    const [subcommand, name, ...extraArgs] = args;
    if (subcommand === '--help' || subcommand === '-h') {
      io.stdout(MAKE_FEATURE_HELP);
      return { exitCode: 0 };
    }
    if (subcommand !== 'feature') {
      io.stderr('Usage: nara make feature <name>\n');
      return { exitCode: 64 };
    }
    if (name === '--help' || name === '-h') {
      io.stdout(MAKE_FEATURE_HELP);
      return { exitCode: 0 };
    }
    if (!name || extraArgs.length > 0) {
      io.stderr(MAKE_FEATURE_HELP);
      return { exitCode: 64 };
    }

    const result = makeFeature(name, options.cwd);
    if (!result.ok) {
      io.stderr(`${result.error.message}\n`);
      return { exitCode: generationExitCode(result.error.kind) };
    }

    io.stdout(`Created feature "${name}" at ${result.feature.directory}.\n`);
    return { exitCode: 0 };
  }

  if (args.includes('--help') || args.includes('-h')) {
    io.stderr(`Unknown command: ${command}\nRun nara --help for available commands.\n`);
    return { exitCode: 64 };
  }

  io.stderr(`Unknown command: ${command}\nRun nara --help for available commands.\n`);
  return { exitCode: 64 };
}
