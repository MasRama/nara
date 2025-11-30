import { spawn } from "child_process";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class DbRollback {
  public args: string[] = [];
  public commandName = "db:rollback";
  public description = "Rollback the last database migration";

  public async run() {
    const envArg = this.args.find(arg => arg.startsWith('--env='));
    const env = envArg ? envArg.split('=')[1] : 'development';
    
    const allFlag = this.args.includes('--all');
    
    printInfo(`Rolling back migrations for ${c.cyan}${env}${c.reset} environment...`);
    
    const knexArgs = ['knex', 'migrate:rollback', '--env', env];
    if (allFlag) {
      knexArgs.push('--all');
      printInfo(`${c.yellow}Rolling back ALL migrations${c.reset}`);
    }
    
    const knex = spawn('npx', knexArgs, {
      stdio: 'inherit',
      shell: true,
    });

    knex.on('close', (code) => {
      if (code === 0) {
        printSuccess(`Rollback completed successfully`);
      } else {
        printError(`Rollback failed with exit code ${code}`);
      }
      console.log();
    });

    knex.on('error', (err) => {
      printError(`Failed to rollback: ${err.message}`);
      console.log();
    });
  }
}

export default new DbRollback();
