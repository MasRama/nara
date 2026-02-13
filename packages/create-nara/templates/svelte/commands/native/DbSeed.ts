import { spawn } from "child_process";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class DbSeed {
  public args: string[] = [];
  public commandName = "db:seed";
  public description = "Run database seeders";

  public async run() {
    const envArg = this.args.find(arg => arg.startsWith('--env='));
    const env = envArg ? envArg.split('=')[1] : 'development';
    
    const specificSeed = this.args.find(arg => arg.startsWith('--specific='));
    
    printInfo(`Running seeders for ${c.cyan}${env}${c.reset} environment...`);
    
    const knexArgs = ['knex', 'seed:run', '--env', env];
    if (specificSeed) {
      const seedFile = specificSeed.split('=')[1];
      knexArgs.push('--specific', seedFile);
      printInfo(`Running specific seeder: ${c.cyan}${seedFile}${c.reset}`);
    }
    
    const knex = spawn('npx', knexArgs, {
      stdio: 'inherit',
      shell: true,
    });

    knex.on('close', (code) => {
      if (code === 0) {
        printSuccess(`Seeding completed successfully`);
      } else {
        printError(`Seeding failed with exit code ${code}`);
      }
      console.log();
    });

    knex.on('error', (err) => {
      printError(`Failed to run seeders: ${err.message}`);
      console.log();
    });
  }
}

export default new DbSeed();
