import * as fs from "fs";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeMiddleware {
   public args: string[] = [];
   public commandName = "make:middleware";
   public description = "Create a new middleware";

   public run() {
      if (this.args.length < 2) {
         printError("Middleware name is required.");
         console.log(`\n${c.dim}Usage: node nara make:middleware <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:middleware RateLimit${c.reset}\n`);
         return;
      }

      let name = this.args[1];
      
      // Clean up name and ensure proper casing
      const className = name.charAt(0).toLowerCase() + name.slice(1);
      const filename = className + ".ts";
      const filepath = "./app/middlewares/" + filename;

      if (fs.existsSync(filepath)) {
         printError(`Middleware already exists: ${filepath}`);
         return;
      }

      fs.writeFileSync(filepath, this.getTemplate(className, name));
      
      printSuccess(`Middleware created: ${c.cyan}app/middlewares/${filename}${c.reset}`);
      printInfo(`Register in routes: ${c.cyan}Route.get("/path", [${className}], handler)${c.reset}`);
      console.log();
   }

   getTemplate(filename: string, name: string) {
      return `/**
 * ${name} Middleware
 * 
 * Middleware for request processing.
 */
import { Request, Response } from "@type";
import Logger from "@services/Logger";

/**
 * ${name} middleware handler
 */
async function ${filename}(request: Request, response: Response) {
  try {
    // Add your middleware logic here
    // Example: Check headers, validate tokens, rate limiting, etc.
    
    // To block the request:
    // return response.status(403).json({ success: false, message: "Forbidden" });
    
    // To continue to next middleware/handler:
    // Just return without sending response
    
  } catch (error) {
    Logger.error('${name} middleware error', error as Error);
    return response.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
}

export default ${filename};
`;
   }
}

export default new MakeMiddleware();
