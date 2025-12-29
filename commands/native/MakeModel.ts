import * as fs from "fs";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeModel {
   public args: string[] = [];
   public commandName = "make:model";
   public description = "Create a new model class";

   public run() {
      if (this.args.length < 2) {
         printError("Model name is required.");
         console.log(`\n${c.dim}Usage: node nara make:model <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:model Post${c.reset}\n`);
         return;
      }

      let name = this.args[1];
      
      // Clean up name and ensure proper casing
      name = name.replace(/model$/i, "");
      const className = name.charAt(0).toUpperCase() + name.slice(1);
      const tableName = this.toSnakeCase(name) + "s";
      const filename = className + ".ts";
      const filepath = "./app/models/" + filename;

      // Ensure models directory exists
      if (!fs.existsSync("./app/models")) {
         fs.mkdirSync("./app/models", { recursive: true });
      }

      if (fs.existsSync(filepath)) {
         printError(`Model already exists: ${filepath}`);
         return;
      }

      fs.writeFileSync(filepath, this.getTemplate(className, tableName));
      
      printSuccess(`Model created: ${c.cyan}app/models/${filename}${c.reset}`);
      printInfo(`Don't forget to export the model in ${c.cyan}app/models/index.ts${c.reset}`);
      console.log();
   }

   private toSnakeCase(str: string): string {
      return str
         .replace(/([A-Z])/g, '_$1')
         .toLowerCase()
         .replace(/^_/, '');
   }

   getTemplate(className: string, tableName: string) {
      return `/**
 * ${className} Model
 * 
 * Handles all ${className.toLowerCase()}-related database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";

/**
 * ${className} record interface
 */
export interface ${className}Record extends BaseRecord {
  id: string;
  name: string | null;
  // TODO: Add more fields based on your database schema
  created_at: number;
  updated_at: number;
}

/**
 * Data for creating a new ${className.toLowerCase()}
 */
export interface Create${className}Data {
  id: string;
  name?: string | null;
  // TODO: Add more fields
}

/**
 * Data for updating a ${className.toLowerCase()}
 */
export interface Update${className}Data {
  name?: string | null;
  // TODO: Add more fields
}

class ${className}Model extends BaseModel<${className}Record> {
  protected tableName = "${tableName}";

  /**
   * Find ${className.toLowerCase()} by name
   */
  async findByName(name: string): Promise<${className}Record | undefined> {
    return this.query().where("name", name).first();
  }

  // TODO: Add more custom methods as needed
}

export const ${className} = new ${className}Model();
export default ${className};
`;
   }
}

export default new MakeModel();
