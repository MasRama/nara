import { analyzeArchitecture } from './architecture/doctor';
import path from 'node:path';
import { buildFeatureContext } from './architecture/context';
import type { FeatureContext } from './architecture/context';
import { inspectFeatureImpact } from './architecture/impact';
import type { FeatureImpact } from './architecture/impact';
import { inspectFeature } from './architecture/inspect';
import type { FeatureInspection } from './architecture/inspect';
import { installOfficialFeature } from './composition/install-feature';
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

Commands:
  help                      Show this help message
  new <name>                Create a runnable Nara application
  make feature <name>       Create a feature using the canonical structure
  doctor [--json]           Validate feature architecture
  inspect <feature> [--json] Describe one feature
  context <feature> [--json] Produce bounded coding context
  impact <feature> [--json] Show known downstream feature impact
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

Describes one feature's public interface, dependencies, entrypoints, contracts, and tests.
`;

const CONTEXT_HELP = `Usage:
  nara context <feature> [--json]

Produces bounded coding context without dumping source files.
`;

const IMPACT_HELP = `Usage:
  nara impact <feature> [--json]

Shows direct and transitive dependents from the known feature dependency graph.
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

function renderFeatureInspection(io: CliIO, feature: FeatureInspection): void {
  io.stdout(`Feature: ${feature.name}\n`);
  io.stdout(`Path: ${feature.path}\n\n`);
  renderFeatureList(io, 'Public exports', feature.publicExports);
  renderFeatureList(io, 'Dependencies', feature.dependencies);
  renderFeatureList(io, 'Dependents', feature.dependents);
  renderFeatureList(io, 'Server', feature.serverEntrypoints);
  renderFeatureList(io, 'Web', feature.webEntrypoints);
  renderFeatureList(io, 'Contracts', feature.contracts);
  renderFeatureList(io, 'Tests', feature.tests);
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

function renderFeatureContext(io: CliIO, context: FeatureContext): void {
  io.stdout(`Feature context: ${context.name}\n`);
  io.stdout(`Work in: ${context.workDirectory}\n`);
  io.stdout(`Public boundary: ${context.publicBoundary}\n\n`);
  renderFeatureList(io, 'Public dependencies', context.publicDependencies);
  renderFeatureList(io, 'Dependents', context.dependents);
  renderFeatureList(io, 'Contracts', context.contracts);
  renderFeatureList(io, 'Server surfaces', context.serverSurfaces);
  renderFeatureList(io, 'Web surfaces', context.webSurfaces);
  renderFeatureList(io, 'Test surfaces', context.testSurfaces);
}

function renderContextReport(io: CliIO, name: string, root: string | undefined, json = false): number {
  try {
    const result = buildFeatureContext(name, root);
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
      renderFeatureContext(io, result.context);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      io.stdout(`${JSON.stringify({ error: message }, null, 2)}\n`);
    } else {
      io.stderr(`Could not build context for "${name}": ${message}\n`);
    }
    return 73;
  }
}

function renderFeatureImpact(io: CliIO, impact: FeatureImpact): void {
  io.stdout(`Feature impact: ${impact.name}\n`);
  renderFeatureList(io, 'Direct dependents', impact.directDependents);
  renderFeatureList(io, 'Transitive dependents', impact.transitiveDependents);
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
    const [name, format, ...extraArgs] = args;
    if (name === '--help' || name === '-h') {
      io.stdout(CONTEXT_HELP);
      return { exitCode: 0 };
    }
    if (!name || name === '--json' || (format && format !== '--json') || extraArgs.length > 0) {
      io.stderr(CONTEXT_HELP);
      return { exitCode: 64 };
    }
    return { exitCode: renderContextReport(io, name, options.cwd, format === '--json') };
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
