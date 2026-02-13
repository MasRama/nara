import { spawn } from "child_process";
import { printSuccess, printInfo, printError, colors } from "../index";

const c = colors;

class TypeCheck {
  public args: string[] = [];
  public commandName = "typecheck";
  public description = "Run TypeScript type check (tsc --noEmit)";

  public async run() {
    const watchFlag = this.args.includes('--watch');
    
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

    tsc.on('error', (err) => {
      printError(`Failed to run TypeScript check: ${err.message}`);
      console.log();
    });
  }
}

export default new TypeCheck();
