import { spawn } from "child_process";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class DbFresh {
  public args: string[] = [];
  public commandName = "db:fresh";
  public description = "Drop all tables and re-run all migrations";

  public async run() {
    const envArg = this.args.find(arg => arg.startsWith('--env='));
    const env = envArg ? envArg.split('=')[1] : 'development';
    
    const seedFlag = this.args.includes('--seed');
    
    printInfo(`${c.yellow}⚠ WARNING: This will drop ALL tables!${c.reset}`);
    printInfo(`Running fresh migration for ${c.cyan}${env}${c.reset} environment...`);
    
    // First rollback all
    const rollback = spawn('npx', ['knex', 'migrate:rollback', '--all', '--env', env], {
      stdio: 'inherit',
      shell: true,
    });

    rollback.on('close', (rollbackCode) => {
      if (rollbackCode !== 0) {
        printError(`Rollback failed with exit code ${rollbackCode}`);
        return;
      }
      
      // Then migrate
      const migrate = spawn('npx', ['knex', 'migrate:latest', '--env', env], {
        stdio: 'inherit',
        shell: true,
      });

      migrate.on('close', (migrateCode) => {
        if (migrateCode !== 0) {
          printError(`Migration failed with exit code ${migrateCode}`);
          return;
        }
        
        if (seedFlag) {
          // Run seeders
          const seed = spawn('npx', ['knex', 'seed:run', '--env', env], {
            stdio: 'inherit',
            shell: true,
          });

          seed.on('close', (seedCode) => {
            if (seedCode === 0) {
              printSuccess(`Fresh migration with seeding completed successfully`);
            } else {
              printError(`Seeding failed with exit code ${seedCode}`);
            }
            console.log();
          });
        } else {
          printSuccess(`Fresh migration completed successfully`);
          console.log();
        }
      });
    });

    rollback.on('error', (err) => {
      printError(`Failed to run fresh migration: ${err.message}`);
      console.log();
    });
  }
}

export default new DbFresh();
