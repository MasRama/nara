import * as fs from "fs";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeValidator {
   public args: string[] = [];
   public commandName = "make:validator";
   public description = "Create a new Zod validation schema";

   public run() {
      if (this.args.length < 2) {
         printError("Validator name is required.");
         console.log(`\n${c.dim}Usage: node nara make:validator <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:validator CreatePost${c.reset}\n`);
         return;
      }

      let name = this.args[1];
      
      // Clean up name and ensure proper casing
      name = name.replace(/schema$/i, "");
      const schemaName = name.charAt(0).toUpperCase() + name.slice(1) + "Schema";
      const typeName = name.charAt(0).toUpperCase() + name.slice(1) + "Input";
      const filename = name.charAt(0).toLowerCase() + name.slice(1) + ".ts";
      const filepath = "./app/validators/" + filename;

      if (fs.existsSync(filepath)) {
         printError(`Validator already exists: ${filepath}`);
         return;
      }

      fs.writeFileSync(filepath, this.getTemplate(schemaName, typeName, name));
      
      printSuccess(`Validator created: ${c.cyan}app/validators/${filename}${c.reset}`);
      printInfo(`Export in ${c.cyan}app/validators/index.ts${c.reset}:`);
      console.log(`${c.dim}  export { ${schemaName} } from './${name.charAt(0).toLowerCase() + name.slice(1)}';${c.reset}`);
      console.log(`${c.dim}  export type { ${typeName} } from './${name.charAt(0).toLowerCase() + name.slice(1)}';${c.reset}`);
      console.log();
   }

   getTemplate(schemaName: string, typeName: string, name: string) {
      return `/**
 * ${name} Validation Schema
 * 
 * Zod schema for ${name.toLowerCase()} validation.
 */
import { z } from 'zod';

/**
 * ${schemaName}
 * 
 * Validation schema for ${name.toLowerCase()} data.
 */
export const ${schemaName} = z.object({
  // Add your fields here
  // Example fields:
  
  // Required string
  // name: z.string().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  
  // Required email (auto-lowercase)
  // email: z.string().email('Format email tidak valid').transform(val => val.toLowerCase()),
  
  // Optional string
  // description: z.string().optional(),
  
  // Optional nullable
  // phone: z.string().optional().nullable(),
  
  // Boolean with default
  // is_active: z.boolean().optional().default(false),
  
  // Number
  // price: z.number().positive('Harga harus positif'),
  
  // Enum
  // status: z.enum(['draft', 'published', 'archived']),
  
  // Array
  // tags: z.array(z.string()).optional().default([]),
  
  // UUID
  // category_id: z.string().uuid('Format ID tidak valid'),
});

/**
 * Type inference from schema
 */
export type ${typeName} = z.infer<typeof ${schemaName}>;
`;
   }
}

export default new MakeValidator();
