import { spawn } from "child_process";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class DbMigrate {
  public args: string[] = [];
  public commandName = "db:migrate";
  public description = "Run database migrations (knex migrate:latest)";

  public async run() {
    const envArg = this.args.find(arg => arg.startsWith('--env='));
    const env = envArg ? envArg.split('=')[1] : 'development';
    
    printInfo(`Running migrations for ${c.cyan}${env}${c.reset} environment...`);
    
    const knex = spawn('npx', ['knex', 'migrate:latest', '--env', env], {
      stdio: 'inherit',
      shell: true,
    });

    knex.on('close', (code) => {
      if (code === 0) {
        printSuccess(`Migrations completed successfully`);
      } else {
        printError(`Migration failed with exit code ${code}`);
      }
      console.log();
    });

    knex.on('error', (err) => {
      printError(`Failed to run migrations: ${err.message}`);
      console.log();
    });
  }
}

export default new DbMigrate();
