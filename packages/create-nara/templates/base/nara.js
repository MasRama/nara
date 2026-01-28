#!/usr/bin/env node

/*
|--------------------------------------------------------------------------
| Nara CLI Entry Point
|--------------------------------------------------------------------------
|
| Usage: node nara <command> [options]
|
| Examples:
|   node nara db:migrate
|   node nara db:migrate --env=production
|   node nara db:seed
|   node nara make:migration create_posts
|
*/

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const cliPath = join(__dirname, 'bin', 'cli.ts');

spawn('npx', ['tsx', cliPath, ...args], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
}).on('close', (code) => process.exit(code || 0))
  .on('error', (err) => {
    console.error('Failed to start Nara CLI:', err.message);
    process.exit(1);
  });
