import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  recommendation?: string;
}

class Doctor {
  public args: string[] = [];
  public commandName = "doctor";
  public description = "Check project health and configuration";

  private results: CheckResult[] = [];

  public async run() {
    console.log();
    console.log(`${c.cyan}${c.bright}🩺 Nara Doctor - Project Health Check${c.reset}`);
    console.log(`${c.dim}─────────────────────────────────────────${c.reset}`);
    console.log();

    // Run all checks
    await this.checkNodeVersion();
    await this.checkDependencies();
    await this.checkEnvFile();
    await this.checkEnvVariables();
    await this.checkDatabase();
    await this.checkRedis();
    await this.checkFolderPermissions();
    await this.checkTypeScript();

    // Print summary
    this.printSummary();
  }

  private async checkNodeVersion() {
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion >= 18) {
        this.results.push({
          name: 'Node.js Version',
          status: 'ok',
          message: `${nodeVersion} (recommended: >= 18.x)`,
        });
      } else if (majorVersion >= 16) {
        this.results.push({
          name: 'Node.js Version',
          status: 'warning',
          message: `${nodeVersion}`,
          recommendation: 'Upgrade to Node.js 18+ for best performance',
        });
      } else {
        this.results.push({
          name: 'Node.js Version',
          status: 'error',
          message: `${nodeVersion}`,
          recommendation: 'Node.js 16+ is required, 18+ recommended',
        });
      }
    } catch {
      this.results.push({
        name: 'Node.js Version',
        status: 'error',
        message: 'Could not determine Node.js version',
      });
    }
  }

  private async checkDependencies() {
    const packageJsonPath = './package.json';
    
    if (!fs.existsSync(packageJsonPath)) {
      this.results.push({
        name: 'Dependencies',
        status: 'error',
        message: 'package.json not found',
      });
      return;
    }

    const nodeModulesPath = './node_modules';
    if (!fs.existsSync(nodeModulesPath)) {
      this.results.push({
        name: 'Dependencies',
        status: 'error',
        message: 'node_modules not found',
        recommendation: 'Run: npm install',
      });
      return;
    }

    // Check key dependencies
    const keyDeps = ['hyper-express', 'knex', 'better-sqlite3', 'pino'];
    const missingDeps: string[] = [];

    for (const dep of keyDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      if (!fs.existsSync(depPath)) {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      this.results.push({
        name: 'Dependencies',
        status: 'warning',
        message: `Missing: ${missingDeps.join(', ')}`,
        recommendation: 'Run: npm install',
      });
    } else {
      this.results.push({
        name: 'Dependencies',
        status: 'ok',
        message: 'All key dependencies installed',
      });
    }
  }

  private async checkEnvFile() {
    const envPath = './.env';
    const envExamplePath = './.env.example';

    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(envExamplePath)) {
        this.results.push({
          name: '.env File',
          status: 'error',
          message: '.env file not found',
          recommendation: 'Copy .env.example to .env and configure',
        });
      } else {
        this.results.push({
          name: '.env File',
          status: 'error',
          message: '.env file not found',
          recommendation: 'Create .env file with required variables',
        });
      }
      return;
    }

    this.results.push({
      name: '.env File',
      status: 'ok',
      message: '.env file exists',
    });
  }

  private async checkEnvVariables() {
    // Load .env if exists
    const envPath = './.env';
    const envVars: Record<string, string> = {};
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          envVars[match[1].trim()] = match[2].trim();
        }
      }
    }

    // Required variables
    const required = ['NODE_ENV', 'APP_URL'];
    const missing: string[] = [];
    
    for (const key of required) {
      if (!envVars[key] && !process.env[key]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      this.results.push({
        name: 'Environment Variables',
        status: 'warning',
        message: `Missing: ${missing.join(', ')}`,
        recommendation: 'Set required environment variables in .env',
      });
    } else {
      this.results.push({
        name: 'Environment Variables',
        status: 'ok',
        message: 'Required variables configured',
      });
    }

    // Optional but recommended
    const optional = ['GOOGLE_CLIENT_ID', 'USER_MAILER'];
    const missingOptional: string[] = [];
    
    for (const key of optional) {
      if (!envVars[key] && !process.env[key]) {
        missingOptional.push(key);
      }
    }

    if (missingOptional.length > 0) {
      this.results.push({
        name: 'Optional Features',
        status: 'warning',
        message: `Not configured: ${missingOptional.join(', ')}`,
        recommendation: 'Configure for full functionality',
      });
    }
  }

  private async checkDatabase() {
    // Check if SQLite database exists
    const devDb = './dev.sqlite3';
    const prodDb = './production.sqlite3';

    if (fs.existsSync(devDb)) {
      const stats = fs.statSync(devDb);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      this.results.push({
        name: 'Database (dev)',
        status: 'ok',
        message: `dev.sqlite3 exists (${sizeMB} MB)`,
      });
    } else {
      this.results.push({
        name: 'Database (dev)',
        status: 'warning',
        message: 'dev.sqlite3 not found',
        recommendation: 'Run: node nara db:migrate',
      });
    }

    // Check migrations folder
    const migrationsPath = './migrations';
    if (fs.existsSync(migrationsPath)) {
      const migrations = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
      this.results.push({
        name: 'Migrations',
        status: 'ok',
        message: `${migrations.length} migration file(s) found`,
      });
    } else {
      this.results.push({
        name: 'Migrations',
        status: 'warning',
        message: 'No migrations folder found',
      });
    }
  }

  private async checkRedis() {
    // Check if ioredis is installed and try to ping
    const ioredisPath = './node_modules/ioredis';
    
    if (!fs.existsSync(ioredisPath)) {
      this.results.push({
        name: 'Redis',
        status: 'warning',
        message: 'ioredis not installed',
        recommendation: 'Install ioredis for caching support',
      });
      return;
    }

    // Try to connect to Redis
    try {
      const Redis = require('ioredis');
      const redis = new Redis({ 
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
      
      await redis.connect();
      await redis.ping();
      await redis.disconnect();
      
      this.results.push({
        name: 'Redis',
        status: 'ok',
        message: 'Connected successfully',
      });
    } catch (error: any) {
      this.results.push({
        name: 'Redis',
        status: 'warning',
        message: 'Not running or not accessible',
        recommendation: 'Start Redis server for caching',
      });
    }
  }

  private async checkFolderPermissions() {
    const folders = [
      { path: './logs', name: 'Logs' },
      { path: './backups', name: 'Backups' },
      { path: './storage', name: 'Storage' },
    ];

    for (const folder of folders) {
      if (!fs.existsSync(folder.path)) {
        this.results.push({
          name: `${folder.name} Folder`,
          status: 'warning',
          message: `${folder.path} does not exist`,
          recommendation: `Create folder: mkdir -p ${folder.path}`,
        });
        continue;
      }

      try {
        // Try to write a test file
        const testFile = path.join(folder.path, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        
        this.results.push({
          name: `${folder.name} Folder`,
          status: 'ok',
          message: `${folder.path} is writable`,
        });
      } catch {
        this.results.push({
          name: `${folder.name} Folder`,
          status: 'error',
          message: `${folder.path} is not writable`,
          recommendation: `Fix permissions: chmod 755 ${folder.path}`,
        });
      }
    }
  }

  private async checkTypeScript() {
    const tsconfigPath = './tsconfig.json';
    
    if (!fs.existsSync(tsconfigPath)) {
      this.results.push({
        name: 'TypeScript',
        status: 'error',
        message: 'tsconfig.json not found',
      });
      return;
    }

    try {
      // tsconfig.json contains comments, so we need to strip them before parsing
      const content = fs.readFileSync(tsconfigPath, 'utf-8');
      // Remove single-line comments (// ...) and multi-line comments (/* ... */)
      const jsonWithoutComments = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* ... */
        .replace(/\/\/.*$/gm, '')          // Remove // ...
        .replace(/,(\s*[}\]])/g, '$1');    // Remove trailing commas
      
      const tsconfig = JSON.parse(jsonWithoutComments);
      const strict = tsconfig.compilerOptions?.strict;
      
      if (strict) {
        this.results.push({
          name: 'TypeScript',
          status: 'ok',
          message: 'Strict mode enabled',
        });
      } else {
        this.results.push({
          name: 'TypeScript',
          status: 'warning',
          message: 'Strict mode not enabled',
          recommendation: 'Enable strict mode in tsconfig.json',
        });
      }
    } catch (err: any) {
      this.results.push({
        name: 'TypeScript',
        status: 'error',
        message: `Could not parse tsconfig.json: ${err.message}`,
      });
    }
  }

  private printSummary() {
    console.log(`${c.yellow}${c.bright}Results:${c.reset}`);
    console.log();

    for (const result of this.results) {
      let icon: string;
      let color: string;
      
      switch (result.status) {
        case 'ok':
          icon = '✓';
          color = c.green;
          break;
        case 'warning':
          icon = '⚠';
          color = c.yellow;
          break;
        case 'error':
          icon = '✗';
          color = c.red;
          break;
      }

      console.log(`  ${color}${icon}${c.reset} ${c.bright}${result.name}${c.reset}`);
      console.log(`    ${c.dim}${result.message}${c.reset}`);
      
      if (result.recommendation) {
        console.log(`    ${c.cyan}→ ${result.recommendation}${c.reset}`);
      }
      console.log();
    }

    // Summary counts
    const okCount = this.results.filter(r => r.status === 'ok').length;
    const warningCount = this.results.filter(r => r.status === 'warning').length;
    const errorCount = this.results.filter(r => r.status === 'error').length;

    console.log(`${c.dim}─────────────────────────────────────────${c.reset}`);
    console.log(`${c.bright}Summary:${c.reset} ${c.green}${okCount} passed${c.reset}, ${c.yellow}${warningCount} warnings${c.reset}, ${c.red}${errorCount} errors${c.reset}`);
    console.log();

    if (errorCount > 0) {
      console.log(`${c.red}${c.bright}⚠ Please fix the errors above before deploying to production.${c.reset}`);
    } else if (warningCount > 0) {
      console.log(`${c.yellow}${c.bright}ℹ Consider addressing the warnings for optimal configuration.${c.reset}`);
    } else {
      console.log(`${c.green}${c.bright}✓ Your project is healthy and ready for production!${c.reset}`);
    }
    console.log();
  }
}

export default new Doctor();
