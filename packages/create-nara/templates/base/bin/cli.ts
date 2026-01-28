#!/usr/bin/env node

/**
 * Nara CLI
 *
 * Simple command-line interface for Nara projects.
 * Usage: node nara.js <command> [options]
 */

import { spawn } from 'child_process';

// ANSI color codes
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function printBanner() {
  console.log(`
${c.cyan}${c.bright}    _   __
   / | / /___ __________ _
  /  |/ / __ \`/ ___/ __ \`/
 / /|  / /_/ / /  / /_/ /
/_/ |_/\\__,_/_/   \\__,_/
${c.reset}
${c.dim}High-performance TypeScript Web Framework${c.reset}
`);
}

function printHelp() {
  printBanner();

  console.log(`${c.yellow}${c.bright}Usage:${c.reset}`);
  console.log(`  node nara <command> [arguments]\n`);

  console.log(`${c.yellow}${c.bright}Database Commands:${c.reset}`);
  console.log(`  ${c.cyan}db:migrate${c.reset}         ${c.dim}Run database migrations${c.reset}`);
  console.log(`  ${c.cyan}db:rollback${c.reset}        ${c.dim}Rollback last batch of migrations${c.reset}`);
  console.log(`  ${c.cyan}db:seed${c.reset}            ${c.dim}Run database seeders${c.reset}`);
  console.log(`  ${c.cyan}db:fresh${c.reset}           ${c.dim}Drop all tables and re-run migrations${c.reset}`);
  console.log(`  ${c.cyan}db:status${c.reset}          ${c.dim}Show migration status${c.reset}`);

  console.log(`\n${c.yellow}${c.bright}Make Commands:${c.reset}`);
  console.log(`  ${c.cyan}make:migration${c.reset}     ${c.dim}Create a new migration file${c.reset}`);
  console.log(`  ${c.cyan}make:seed${c.reset}          ${c.dim}Create a new seed file${c.reset}`);

  console.log(`\n${c.yellow}${c.bright}Options:${c.reset}`);
  console.log(`  ${c.dim}--env=<environment>${c.reset}  Specify environment (default: development)`);

  console.log(`\n${c.yellow}${c.bright}Examples:${c.reset}`);
  console.log(`  ${c.dim}node nara db:migrate${c.reset}`);
  console.log(`  ${c.dim}node nara db:migrate --env=production${c.reset}`);
  console.log(`  ${c.dim}node nara db:seed${c.reset}`);
  console.log(`  ${c.dim}node nara make:migration create_posts${c.reset}`);
  console.log();
}

function printSuccess(message: string) {
  console.log(`\n${c.green}✔${c.reset} ${message}`);
}

function printError(message: string) {
  console.log(`\n${c.red}✖${c.reset} ${message}`);
}

function printInfo(message: string) {
  console.log(`${c.blue}ℹ${c.reset} ${message}`);
}

function getEnvArg(args: string[]): string {
  const envArg = args.find(arg => arg.startsWith('--env='));
  return envArg ? envArg.split('=')[1] : 'development';
}

function runKnex(knexArgs: string[], env: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', 'node_modules/.bin/knex', ...knexArgs, '--env', env], {
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', (code) => {
      resolve(code || 0);
    });

    proc.on('error', (err) => {
      printError(`Failed to run command: ${err.message}`);
      resolve(1);
    });
  });
}

const commands: Record<string, (args: string[]) => Promise<void>> = {
  'db:migrate': async (args) => {
    const env = getEnvArg(args);
    printInfo(`Running migrations for ${c.cyan}${env}${c.reset} environment...`);
    const code = await runKnex(['migrate:latest'], env);
    if (code === 0) {
      printSuccess('Migrations completed successfully');
    }
  },

  'db:rollback': async (args) => {
    const env = getEnvArg(args);
    printInfo(`Rolling back migrations for ${c.cyan}${env}${c.reset} environment...`);
    const code = await runKnex(['migrate:rollback'], env);
    if (code === 0) {
      printSuccess('Rollback completed successfully');
    }
  },

  'db:seed': async (args) => {
    const env = getEnvArg(args);
    printInfo(`Running seeders for ${c.cyan}${env}${c.reset} environment...`);
    const code = await runKnex(['seed:run'], env);
    if (code === 0) {
      printSuccess('Seeding completed successfully');
    }
  },

  'db:fresh': async (args) => {
    const env = getEnvArg(args);
    printInfo(`Dropping all tables and re-running migrations for ${c.cyan}${env}${c.reset} environment...`);
    await runKnex(['migrate:rollback', '--all'], env);
    const code = await runKnex(['migrate:latest'], env);
    if (code === 0) {
      printSuccess('Database refreshed successfully');
    }
  },

  'db:status': async (args) => {
    const env = getEnvArg(args);
    printInfo(`Migration status for ${c.cyan}${env}${c.reset} environment:`);
    await runKnex(['migrate:status'], env);
  },

  'make:migration': async (args) => {
    const name = args.find(arg => !arg.startsWith('--'));
    if (!name) {
      printError('Migration name is required');
      console.log(`\n${c.dim}Usage: node nara make:migration <name>${c.reset}\n`);
      return;
    }
    const env = getEnvArg(args);
    printInfo(`Creating migration: ${c.cyan}${name}${c.reset}`);
    const code = await runKnex(['migrate:make', name], env);
    if (code === 0) {
      printSuccess(`Migration created successfully`);
    }
  },

  'make:seed': async (args) => {
    const name = args.find(arg => !arg.startsWith('--'));
    if (!name) {
      printError('Seed name is required');
      console.log(`\n${c.dim}Usage: node nara make:seed <name>${c.reset}\n`);
      return;
    }
    const env = getEnvArg(args);
    printInfo(`Creating seed: ${c.cyan}${name}${c.reset}`);
    const code = await runKnex(['seed:make', name], env);
    if (code === 0) {
      printSuccess(`Seed created successfully`);
    }
  },
};

// Main
const args = process.argv.slice(2);
const commandName = args[0];
const commandArgs = args.slice(1);

if (!commandName || commandName === 'help' || commandName === '--help' || commandName === '-h') {
  printHelp();
  process.exit(0);
}

const command = commands[commandName];

if (command) {
  command(commandArgs).catch((err) => {
    printError(err.message);
    process.exit(1);
  });
} else {
  printError(`Command "${commandName}" not found.`);
  console.log(`\n${c.dim}Run "node nara help" to see available commands.${c.reset}\n`);
  process.exit(1);
}
