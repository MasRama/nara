import { spawn } from "child_process";
import { printInfo, colors } from "../index";

const c = colors;

class DbStatus {
  public args: string[] = [];
  public commandName = "db:status";
  public description = "Show migration status";

  public async run() {
    const envArg = this.args.find(arg => arg.startsWith('--env='));
    const env = envArg ? envArg.split('=')[1] : 'development';
    
    printInfo(`Migration status for ${c.cyan}${env}${c.reset} environment:\n`);
    
    const knex = spawn('npx', ['tsx', 'node_modules/.bin/knex', 'migrate:status', '--env', env], {
      stdio: 'inherit',
      shell: true,
    });

    knex.on('close', () => {
      console.log();
    });

    knex.on('error', (err) => {
      console.error(`Failed to get status: ${err.message}`);
      console.log();
    });
  }
}

export default new DbStatus();
