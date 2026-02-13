import { spawn } from "child_process";
import { printSuccess, printInfo, printError, colors } from "../index";

const c = colors;

class Lint {
  public args: string[] = [];
  public commandName = "lint";
  public description = "Run linting and type check";

  public async run() {
    const fixFlag = this.args.includes('--fix');
    const typeOnlyFlag = this.args.includes('--type-only');
    
    if (typeOnlyFlag) {
      // Only run TypeScript check
      await this.runTypeCheck();
      return;
    }
    
    // Run TypeScript type check first
    printInfo(`Running TypeScript type check...`);
    console.log();
    
    const tsc = spawn('npx', ['tsc', '--noEmit'], {
      stdio: 'inherit',
      shell: true,
    });

    tsc.on('close', async (code) => {
      if (code !== 0) {
        printError(`TypeScript check failed with ${code} error(s)`);
        console.log();
        process.exit(1);
      }
      
      printSuccess(`TypeScript check passed`);
      console.log();
      
      // Then run ESLint if available
      await this.runEslint(fixFlag);
    });

    tsc.on('error', (err) => {
      printError(`Failed to run TypeScript check: ${err.message}`);
      console.log();
    });
  }

  private async runTypeCheck() {
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
  }

  private async runEslint(fix: boolean) {
    printInfo(`Running ESLint...`);
    console.log();
    
    const eslintArgs = ['eslint', '.', '--ext', '.ts,.tsx,.js,.jsx'];
    if (fix) {
      eslintArgs.push('--fix');
      printInfo(`${c.cyan}Auto-fix enabled${c.reset}`);
    }
    
    const eslint = spawn('npx', eslintArgs, {
      stdio: 'inherit',
      shell: true,
    });

    eslint.on('close', (code) => {
      if (code === 0) {
        printSuccess(`Linting passed`);
      } else if (code === 1) {
        printError(`Linting found issues`);
      }
      // code 2 means ESLint not found, which is fine
      console.log();
    });

    eslint.on('error', () => {
      // ESLint not installed, skip silently
      printInfo(`${c.dim}ESLint not installed, skipping...${c.reset}`);
      console.log();
    });
  }
}

export default new Lint();
