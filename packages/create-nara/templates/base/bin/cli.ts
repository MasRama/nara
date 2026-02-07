#!/usr/bin/env node

/**
 * Nara CLI
 *
 * Command-line interface for Nara projects.
 * Usage: node nara.js <command> [options]
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
  magenta: '\x1b[35m',
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

  console.log(`${c.yellow}${c.bright}Available Commands:${c.reset}`);
  
  console.log(`\n  ${c.green}${c.bright}make${c.reset} ${c.dim}(scaffolding)${c.reset}`);
  console.log(`    ${c.cyan}make:controller${c.reset}      ${c.dim}Create a new controller class${c.reset}`);
  console.log(`    ${c.cyan}make:model${c.reset}           ${c.dim}Create a new model class${c.reset}`);
  console.log(`    ${c.cyan}make:service${c.reset}         ${c.dim}Create a new service class${c.reset}`);
  console.log(`    ${c.cyan}make:middleware${c.reset}      ${c.dim}Create a new middleware${c.reset}`);
  console.log(`    ${c.cyan}make:validator${c.reset}       ${c.dim}Create a new validator schema${c.reset}`);
  console.log(`    ${c.cyan}make:migration${c.reset}       ${c.dim}Create a new migration file${c.reset}`);
  console.log(`    ${c.cyan}make:seed${c.reset}            ${c.dim}Create a new seed file${c.reset}`);

  console.log(`\n  ${c.green}${c.bright}db${c.reset} ${c.dim}(database)${c.reset}`);
  console.log(`    ${c.cyan}db:migrate${c.reset}           ${c.dim}Run database migrations${c.reset}`);
  console.log(`    ${c.cyan}db:rollback${c.reset}          ${c.dim}Rollback last batch of migrations${c.reset}`);
  console.log(`    ${c.cyan}db:seed${c.reset}              ${c.dim}Run database seeders${c.reset}`);
  console.log(`    ${c.cyan}db:fresh${c.reset}             ${c.dim}Drop all tables and re-run migrations${c.reset}`);
  console.log(`    ${c.cyan}db:status${c.reset}            ${c.dim}Show migration status${c.reset}`);

  console.log(`\n  ${c.green}${c.bright}dev${c.reset} ${c.dim}(development)${c.reset}`);
  console.log(`    ${c.cyan}lint${c.reset}                 ${c.dim}Run linting and type check${c.reset}`);
  console.log(`    ${c.cyan}typecheck${c.reset}            ${c.dim}Run TypeScript type check${c.reset}`);

  console.log(`\n${c.yellow}${c.bright}Options:${c.reset}`);
  console.log(`  ${c.dim}--env=<environment>${c.reset}  Specify environment (default: development)`);

  console.log(`\n${c.yellow}${c.bright}Examples:${c.reset}`);
  console.log(`  ${c.dim}node nara make:controller User${c.reset}`);
  console.log(`  ${c.dim}node nara make:model Post${c.reset}`);
  console.log(`  ${c.dim}node nara db:migrate${c.reset}`);
  console.log(`  ${c.dim}node nara db:migrate --env=production${c.reset}`);
  console.log(`  ${c.dim}node nara lint${c.reset}`);
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

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

// ==================== SCAFFOLDING TEMPLATES ====================

function getControllerTemplate(className: string, resourceName: string): string {
  return `/**
 * ${className}
 * 
 * Controller for ${resourceName} resource.
 */
import { BaseController } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { db } from '../config/database.js';
import Logger from '../services/Logger.js';
import { randomUUID } from 'crypto';

class ${className} extends BaseController {
  /**
   * Display a listing of the resource.
   */
  public async index(request: NaraRequest, response: NaraResponse) {
    const records = await db('${resourceName}s').select('*').orderBy('created_at', 'desc');
    return response.json({ success: true, data: records });
  }

  /**
   * Store a newly created resource.
   */
  public async store(request: NaraRequest, response: NaraResponse) {
    const data = await request.json();
    const record = { id: randomUUID(), ...data, created_at: new Date().toISOString() };
    
    await db('${resourceName}s').insert(record);
    Logger.info('${resourceName} created', { id: record.id });
    
    return response.status(201).json({ success: true, data: record });
  }

  /**
   * Display the specified resource.
   */
  public async show(request: NaraRequest, response: NaraResponse) {
    const { id } = request.params;
    const record = await db('${resourceName}s').where('id', id).first();
    
    if (!record) {
      return response.status(404).json({ success: false, message: 'Not found' });
    }
    
    return response.json({ success: true, data: record });
  }

  /**
   * Update the specified resource.
   */
  public async update(request: NaraRequest, response: NaraResponse) {
    const { id } = request.params;
    const data = await request.json();
    
    await db('${resourceName}s').where('id', id).update({ ...data, updated_at: new Date().toISOString() });
    const record = await db('${resourceName}s').where('id', id).first();
    
    Logger.info('${resourceName} updated', { id });
    return response.json({ success: true, data: record });
  }

  /**
   * Remove the specified resource.
   */
  public async destroy(request: NaraRequest, response: NaraResponse) {
    const { id } = request.params;
    await db('${resourceName}s').where('id', id).delete();
    
    Logger.info('${resourceName} deleted', { id });
    return response.json({ success: true, message: 'Deleted successfully' });
  }
}

export default new ${className}();
`;
}

function getModelTemplate(className: string, tableName: string): string {
  return `/**
 * ${className} Model
 * 
 * Handles all ${className.toLowerCase()}-related database operations.
 */
import { db } from '../config/database.js';

export interface ${className}Record {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export class ${className}Model {
  static tableName = '${tableName}';

  static async findById(id: string): Promise<${className}Record | undefined> {
    return db(this.tableName).where({ id }).first();
  }

  static async findByName(name: string): Promise<${className}Record | undefined> {
    return db(this.tableName).where({ name }).first();
  }

  static async create(data: Partial<${className}Record>): Promise<number[]> {
    return db(this.tableName).insert(data);
  }

  static async update(id: string, data: Partial<${className}Record>): Promise<number> {
    return db(this.tableName).where({ id }).update(data);
  }

  static async delete(id: string): Promise<number> {
    return db(this.tableName).where({ id }).delete();
  }

  static async all(): Promise<${className}Record[]> {
    return db(this.tableName).select('*').orderBy('created_at', 'desc');
  }
}
`;
}

function getServiceTemplate(className: string, resourceName: string): string {
  return `/**
 * ${className} Service
 * 
 * Business logic for ${resourceName} operations.
 */
import { db } from '../config/database.js';
import Logger from './Logger.js';
import { randomUUID } from 'crypto';

class ${className}Service {
  private tableName = '${resourceName}s';

  /**
   * Get all ${resourceName}s
   */
  async getAll(options: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = 10, search = '' } = options;

    let query = db(this.tableName).select('*');

    if (search) {
      query = query.where('name', 'like', \`%\${search}%\`);
    }

    const data = await query
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    return data;
  }

  /**
   * Get single ${resourceName} by ID
   */
  async getById(id: string) {
    return db(this.tableName).where('id', id).first();
  }

  /**
   * Create new ${resourceName}
   */
  async create(data: Record<string, any>) {
    const record = {
      id: randomUUID(),
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db(this.tableName).insert(record);
    Logger.info('${className} created', { id: record.id });
    
    return record;
  }

  /**
   * Update ${resourceName}
   */
  async update(id: string, data: Record<string, any>) {
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    await db(this.tableName).where('id', id).update(payload);
    Logger.info('${className} updated', { id });
    
    return this.getById(id);
  }

  /**
   * Delete ${resourceName}
   */
  async delete(id: string) {
    const deleted = await db(this.tableName).where('id', id).delete();
    
    if (deleted) {
      Logger.info('${className} deleted', { id });
    }
    
    return deleted > 0;
  }
}

export default new ${className}Service();
`;
}

function getMiddlewareTemplate(className: string, name: string): string {
  return `/**
 * ${className} Middleware
 */
import type { NaraRequest, NaraResponse, NextFunction } from '@nara-web/core';

export function ${name}Middleware(req: NaraRequest, res: NaraResponse, next: NextFunction) {
  // TODO: Add your middleware logic here
  
  // Call next() to continue to the next middleware/handler
  next();
}

export default ${name}Middleware;
`;
}

function getValidatorTemplate(className: string, name: string): string {
  return `/**
 * ${className} Validator
 * 
 * Validation schemas for ${name} operations.
 */

// Using Zod-style validation (install zod: npm i zod)
// import { z } from 'zod';

export const Create${className}Schema = {
  // Define your validation rules here
  // Example with Zod:
  // name: z.string().min(1).max(255),
  // email: z.string().email(),
};

export const Update${className}Schema = {
  // Define your update validation rules here
};

/**
 * Validate data against schema
 * Replace with proper validation library (zod, yup, etc.)
 */
export function validate(data: any, schema: any): { success: boolean; errors?: string[] } {
  // TODO: Implement validation logic
  return { success: true };
}
`;
}

// ==================== COMMAND IMPLEMENTATIONS ====================

const commands: Record<string, (args: string[]) => Promise<void>> = {
  // Database commands
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

  // Scaffolding commands
  'make:controller': async (args) => {
    const name = args.find(arg => !arg.startsWith('--'));
    if (!name) {
      printError('Controller name is required');
      console.log(`\n${c.dim}Usage: node nara make:controller <name>${c.reset}`);
      console.log(`${c.dim}Example: node nara make:controller User${c.reset}\n`);
      return;
    }

    const cleanName = name.replace(/controller$/i, '');
    const className = cleanName.charAt(0).toUpperCase() + cleanName.slice(1) + 'Controller';
    const filename = className + '.ts';
    const filepath = './app/controllers/' + filename;

    if (!fs.existsSync('./app/controllers')) {
      fs.mkdirSync('./app/controllers', { recursive: true });
    }

    if (fs.existsSync(filepath)) {
      printError(`Controller already exists: ${filepath}`);
      return;
    }

    fs.writeFileSync(filepath, getControllerTemplate(className, cleanName.toLowerCase()));
    printSuccess(`Controller created: ${c.cyan}app/controllers/${filename}${c.reset}`);
    printInfo(`Don't forget to register routes in ${c.cyan}routes/web.ts${c.reset}`);
    console.log();
  },

  'make:model': async (args) => {
    const name = args.find(arg => !arg.startsWith('--'));
    if (!name) {
      printError('Model name is required');
      console.log(`\n${c.dim}Usage: node nara make:model <name>${c.reset}`);
      console.log(`${c.dim}Example: node nara make:model Post${c.reset}\n`);
      return;
    }

    const cleanName = name.replace(/model$/i, '');
    const className = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    const tableName = toSnakeCase(cleanName) + 's';
    const filename = className + '.ts';
    const filepath = './app/models/' + filename;

    if (!fs.existsSync('./app/models')) {
      fs.mkdirSync('./app/models', { recursive: true });
    }

    if (fs.existsSync(filepath)) {
      printError(`Model already exists: ${filepath}`);
      return;
    }

    fs.writeFileSync(filepath, getModelTemplate(className, tableName));
    printSuccess(`Model created: ${c.cyan}app/models/${filename}${c.reset}`);
    console.log();
  },

  'make:service': async (args) => {
    const name = args.find(arg => !arg.startsWith('--'));
    if (!name) {
      printError('Service name is required');
      console.log(`\n${c.dim}Usage: node nara make:service <name>${c.reset}`);
      console.log(`${c.dim}Example: node nara make:service Payment${c.reset}\n`);
      return;
    }

    const cleanName = name.replace(/service$/i, '');
    const className = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    const filename = className + '.ts';
    const filepath = './app/services/' + filename;

    if (!fs.existsSync('./app/services')) {
      fs.mkdirSync('./app/services', { recursive: true });
    }

    if (fs.existsSync(filepath)) {
      printError(`Service already exists: ${filepath}`);
      return;
    }

    fs.writeFileSync(filepath, getServiceTemplate(className, cleanName.toLowerCase()));
    printSuccess(`Service created: ${c.cyan}app/services/${filename}${c.reset}`);
    console.log();
  },

  'make:middleware': async (args) => {
    const name = args.find(arg => !arg.startsWith('--'));
    if (!name) {
      printError('Middleware name is required');
      console.log(`\n${c.dim}Usage: node nara make:middleware <name>${c.reset}`);
      console.log(`${c.dim}Example: node nara make:middleware admin${c.reset}\n`);
      return;
    }

    const cleanName = name.replace(/middleware$/i, '');
    const className = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    const filename = cleanName.toLowerCase() + '.ts';
    const filepath = './app/middlewares/' + filename;

    if (!fs.existsSync('./app/middlewares')) {
      fs.mkdirSync('./app/middlewares', { recursive: true });
    }

    if (fs.existsSync(filepath)) {
      printError(`Middleware already exists: ${filepath}`);
      return;
    }

    fs.writeFileSync(filepath, getMiddlewareTemplate(className, cleanName.toLowerCase()));
    printSuccess(`Middleware created: ${c.cyan}app/middlewares/${filename}${c.reset}`);
    console.log();
  },

  'make:validator': async (args) => {
    const name = args.find(arg => !arg.startsWith('--'));
    if (!name) {
      printError('Validator name is required');
      console.log(`\n${c.dim}Usage: node nara make:validator <name>${c.reset}`);
      console.log(`${c.dim}Example: node nara make:validator User${c.reset}\n`);
      return;
    }

    const cleanName = name.replace(/validator$/i, '');
    const className = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    const filename = className + 'Validator.ts';
    const filepath = './app/validators/' + filename;

    if (!fs.existsSync('./app/validators')) {
      fs.mkdirSync('./app/validators', { recursive: true });
    }

    if (fs.existsSync(filepath)) {
      printError(`Validator already exists: ${filepath}`);
      return;
    }

    fs.writeFileSync(filepath, getValidatorTemplate(className, cleanName.toLowerCase()));
    printSuccess(`Validator created: ${c.cyan}app/validators/${filename}${c.reset}`);
    console.log();
  },

  // Dev commands
  'lint': async (args) => {
    printInfo(`Running TypeScript type check...`);
    console.log();
    
    const tsc = spawn('npx', ['tsc', '--noEmit'], {
      stdio: 'inherit',
      shell: true,
    });

    tsc.on('close', (code) => {
      if (code === 0) {
        printSuccess(`TypeScript check passed`);
      } else {
        printError(`TypeScript check failed with ${code} error(s)`);
      }
      console.log();
    });
  },

  'typecheck': async (args) => {
    const watchFlag = args.includes('--watch');
    
    printInfo(`Running TypeScript type check...`);
    
    if (watchFlag) {
      printInfo(`${c.cyan}Watch mode enabled${c.reset}`);
    }
    
    console.log();
    
    const tscArgs = ['tsc', '--noEmit'];
    if (watchFlag) {
      tscArgs.push('--watch');
    }
    
    const tsc = spawn('npx', tscArgs, {
      stdio: 'inherit',
      shell: true,
    });

    tsc.on('close', (code) => {
      if (code === 0) {
        printSuccess(`TypeScript check passed - no errors found`);
      } else {
        printError(`TypeScript check failed with ${code} error(s)`);
      }
      console.log();
    });
  },
};

// ==================== MAIN ====================

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
