import * as fs from "fs";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeValidator {
   public args: string[] = [];
   public commandName = "make:validator";
   public description = "Create a new validation function";

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
 * ${name} Validation
 * 
 * Simple validation function for ${name.toLowerCase()}.
 * No external dependencies - just plain TypeScript.
 */
import { ValidationResult, isString, isEmail, isPhone, isBoolean, isObject } from './validate';

/**
 * ${typeName}
 * 
 * Type definition for ${name.toLowerCase()} data.
 */
export interface ${typeName} {
  // Add your fields here
  // Example fields:
  // name: string;
  // email: string;
  // phone?: string | null;
  // is_active?: boolean;
}

/**
 * ${schemaName}
 * 
 * Validation function for ${name.toLowerCase()} data.
 */
export function ${schemaName}(data: unknown): ValidationResult<${typeName}> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { /* destructure fields here */ } = data as Record<string, unknown>;

  // Add your validation logic here
  // Example validations:
  
  // Required string
  // if (!isString(name) || name.trim().length < 2) {
  //   errors.name = ['Nama minimal 2 karakter'];
  // }
  
  // Required email
  // if (!isEmail(email)) {
  //   errors.email = ['Format email tidak valid'];
  // }
  
  // Optional phone
  // if (phone !== undefined && phone !== null && phone !== '') {
  //   if (!isPhone(phone)) {
  //     errors.phone = ['Format nomor telepon tidak valid'];
  //   }
  // }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      // Return validated data here
      // name: String(name).trim(),
      // email: String(email).toLowerCase(),
      // phone: phone ? String(phone) : null,
      // is_active: isBoolean(is_active) ? is_active : false,
    } as ${typeName}
  };
}
`;
   }
}

export default new MakeValidator();
