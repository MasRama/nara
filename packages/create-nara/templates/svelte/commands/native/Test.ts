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
    
    printInfo(`Running tests...`);
    
    // Build npm test args
    const npmArgs = ['test'];
    
    if (watchFlag) {
      npmArgs.push('--', '--watch');
      printInfo(`${c.cyan}Watch mode enabled${c.reset}`);
    }
    
    if (coverageFlag) {
      npmArgs.push('--', '--coverage');
      printInfo(`${c.cyan}Coverage enabled${c.reset}`);
    }
    
    console.log();
    
    const npm = spawn('npm', npmArgs, {
      stdio: 'inherit',
      shell: true,
    });

    npm.on('close', (code) => {
      if (code !== 0) {
        printError(`Tests failed with exit code ${code}`);
      }
      console.log();
    });

    npm.on('error', (err) => {
      printError(`Failed to run tests: ${err.message}`);
      printInfo(`Make sure you have a test script in package.json`);
      console.log();
    });
  }
}

export default new Test();
