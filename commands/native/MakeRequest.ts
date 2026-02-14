import * as fs from "fs";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeRequest {
   public args: string[] = [];
   public commandName = "make:request";
   public description = "Create a new FormRequest class";

   public run() {
      if (this.args.length < 2) {
         printError("Request name is required.");
         console.log(`\n${c.dim}Usage: node nara make:request <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:request CreatePost${c.reset}\n`);
         return;
      }

      let name = this.args[1];

      // Clean up name and ensure proper casing
      name = name.replace(/request$/i, "");
      const className = name.charAt(0).toUpperCase() + name.slice(1) + "Request";
      const inputType = name.charAt(0).toUpperCase() + name.slice(1) + "Input";
      const schemaName = name.charAt(0).toUpperCase() + name.slice(1) + "Schema";
      const filename = className + ".ts";
      const filepath = "./app/requests/" + filename;

      if (fs.existsSync(filepath)) {
         printError(`Request already exists: ${filepath}`);
         return;
      }

      fs.writeFileSync(filepath, this.getTemplate(className, inputType, schemaName, name));

      printSuccess(`Request created: ${c.cyan}app/requests/${filename}${c.reset}`);
      printInfo(`Export in ${c.cyan}app/requests/index.ts${c.reset}:`);
      console.log(`${c.dim}  export { ${className} } from './${className}';${c.reset}`);
      console.log();
   }

   getTemplate(className: string, inputType: string, schemaName: string, name: string) {
      return `/**
 * ${className}
 *
 * FormRequest for ${name.toLowerCase()} validation and authorization.
 *
 * @example
 * // In controller:
 * const req = await ${className}.from(request);
 * const data = req.validated();
 *
 * // Or with convenience getters:
 * const field = req.someField;
 */
import { FormRequest } from '@core';
import type { ${inputType} } from '@validators';
import { ${schemaName} } from '@validators';

export class ${className} extends FormRequest<${inputType}> {
  /**
   * Determine if the user is authorized to make this request.
   *
   * @returns boolean - true if authorized, false otherwise
   */
  authorize(): boolean {
    // TODO: Implement authorization logic
    // Examples:
    // return !!this.user; // Any authenticated user
    // return this.user?.is_admin === true; // Admin only
    // return this.user?.id === this.param('userId'); // Resource owner
    return true;
  }

  /**
   * Get the validation rules for this request.
   *
   * @returns Validator function from @validators
   */
  rules() {
    return ${schemaName};
  }

  // ============================================================================
  // Convenience Getters
  // ============================================================================
  // TODO: Add convenience getters for validated fields
  // These provide type-safe access to validated data

  // get someField(): string {
  //   return this.validated().someField;
  // }

  // get optionalField(): string | null | undefined {
  //   return this.validated().optionalField;
  // }
}

export default ${className};
`;
   }
}

export default new MakeRequest();
