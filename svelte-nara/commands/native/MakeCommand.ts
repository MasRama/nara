import * as fs from "fs";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeCommand {
   public args: string[] = [];
   public commandName = "make:command";
   public description = "Create a new CLI command";

   public run() {
      if (this.args.length < 2) {
         printError("Command name is required.");
         console.log(`\n${c.dim}Usage: node nara make:command <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:command SyncData${c.reset}\n`);
         return;
      }

      let name = this.args[1];
      
      // Clean up name
      name = name.replace(/[^a-zA-Z0-9]/gi, "");
      const className = name.charAt(0).toUpperCase() + name.slice(1);
      const commandName = name.toLowerCase();
      const filename = className + ".ts";
      const filepath = "./commands/native/" + filename;

      if (fs.existsSync(filepath)) {
         printError(`Command already exists: ${filepath}`);
         return;
      }

      fs.writeFileSync(filepath, this.getTemplate(className, commandName));
      
      printSuccess(`Command created: ${c.cyan}commands/native/${filename}${c.reset}`);
      printInfo(`Run with: ${c.cyan}node nara ${commandName}${c.reset}`);
      console.log();
   }

   getTemplate(className: string, commandName: string) {
      return `import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class ${className} {
   public args: string[] = [];
   public commandName = "${commandName}";
   public description = "Description for ${commandName} command";

   public async run() {
      printInfo("Running ${commandName} command...");
      
      try {
         // Add your command logic here
         
         printSuccess("Command completed successfully!");
      } catch (error: any) {
         printError(\`Command failed: \${error.message}\`);
         process.exit(1);
      }
   }
}

export default new ${className}();
`;
   }
}

export default new MakeCommand();
