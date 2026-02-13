import { execSync } from "child_process";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeSeeder {
   public args: string[] = [];
   public commandName = "make:seeder";
   public description = "Create a new database seeder";

   public run() {
      if (this.args.length < 2) {
         printError("Seeder name is required.");
         console.log(`\n${c.dim}Usage: node nara make:seeder <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:seeder users${c.reset}\n`);
         return;
      }

      const name = this.args[1];
      
      try {
         printInfo(`Creating seeder: ${c.cyan}${name}${c.reset}`);
         
         const output = execSync(`npx knex seed:make ${name}`, {
            encoding: 'utf-8',
            cwd: process.cwd(),
         });
         
         // Extract filename from knex output
         const match = output.match(/Created seed file: (.+)/);
         if (match) {
            printSuccess(`Seeder created: ${c.cyan}${match[1]}${c.reset}`);
         } else {
            printSuccess(`Seeder created successfully`);
            console.log(output);
         }
         
         printInfo(`Run seeders: ${c.cyan}npx knex seed:run${c.reset}`);
         console.log();
      } catch (error: any) {
         printError(`Failed to create seeder: ${error.message}`);
      }
   }
}

export default new MakeSeeder();
