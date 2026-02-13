import { execSync } from "child_process";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeMigration {
   public args: string[] = [];
   public commandName = "make:migration";
   public description = "Create a new database migration";

   public run() {
      if (this.args.length < 2) {
         printError("Migration name is required.");
         console.log(`\n${c.dim}Usage: node nara make:migration <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:migration create_posts_table${c.reset}\n`);
         return;
      }

      const name = this.args[1];
      
      try {
         printInfo(`Creating migration: ${c.cyan}${name}${c.reset}`);
         
         const output = execSync(`npx knex migrate:make ${name}`, {
            encoding: 'utf-8',
            cwd: process.cwd(),
         });
         
         // Extract filename from knex output
         const match = output.match(/Created Migration: (.+)/);
         if (match) {
            printSuccess(`Migration created: ${c.cyan}${match[1]}${c.reset}`);
         } else {
            printSuccess(`Migration created successfully`);
            console.log(output);
         }
         
         printInfo(`Run migrations: ${c.cyan}npx knex migrate:latest${c.reset}`);
         printInfo(`Rollback: ${c.cyan}npx knex migrate:rollback${c.reset}`);
         console.log();
      } catch (error: any) {
         printError(`Failed to create migration: ${error.message}`);
      }
   }
}

export default new MakeMigration();
