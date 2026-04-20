import { spawn } from "child_process";
import { printInfo, printError, colors } from "../index";

const c = colors;

class Test {
  public args: string[] = [];
  public commandName = "test";
  public description = "Run tests (npm test)";

  public async run() {
    const watchFlag = this.args.includes('--watch');
    const coverageFlag = this.args.includes('--coverage');
    
    const vitestArgs = watchFlag ? [] : ['run'];

    if (coverageFlag) {
      vitestArgs.push('--coverage');
    }

    if (watchFlag) {
      printInfo(`${c.cyan}Watch mode enabled${c.reset}`);
    }

    if (coverageFlag) {
      printInfo(`${c.cyan}Coverage enabled${c.reset}`);
    }

    console.log();

    const proc = spawn('npx', ['vitest', ...vitestArgs], {
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        printError(`Tests failed with exit code ${code}`);
      }
      console.log();
    });

    proc.on('error', (err) => {
      printError(`Failed to run tests: ${err.message}`);
      printInfo(`Make sure vitest is installed: npm install -D vitest`);
      console.log();
    });
  }
}

export default new Test();
