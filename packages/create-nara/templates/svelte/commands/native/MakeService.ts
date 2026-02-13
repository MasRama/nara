import * as fs from "fs";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeService {
   public args: string[] = [];
   public commandName = "make:service";
   public description = "Create a new service class";

   public run() {
      if (this.args.length < 2) {
         printError("Service name is required.");
         console.log(`\n${c.dim}Usage: node nara make:service <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:service Payment${c.reset}\n`);
         return;
      }

      let name = this.args[1];
      
      // Clean up name and ensure proper casing
      name = name.replace(/service$/i, "");
      const className = name.charAt(0).toUpperCase() + name.slice(1);
      const filename = className + ".ts";
      const filepath = "./app/services/" + filename;

      if (fs.existsSync(filepath)) {
         printError(`Service already exists: ${filepath}`);
         return;
      }

      fs.writeFileSync(filepath, this.getTemplate(className, name.toLowerCase()));
      
      printSuccess(`Service created: ${c.cyan}app/services/${filename}${c.reset}`);
      console.log();
   }

   getTemplate(className: string, resourceName: string) {
      return `/**
 * ${className} Service
 * 
 * Business logic for ${resourceName} operations.
 */
import DB from "@services/DB";
import Logger from "@services/Logger";
import { PAGINATION } from "@config";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

class ${className}Service {
  /**
   * Get all ${resourceName}s with pagination
   */
  async getAll(options: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = PAGINATION.DEFAULT_PAGE_SIZE, search = "" } = options;

    let query = DB.from("${resourceName}s").select("*");

    if (search) {
      query = query.where(function() {
        this.where('name', 'like', \`%\${search}%\`);
      });
    }

    const countQuery = query.clone();
    const total = await countQuery.count('* as count').first();

    const data = await query
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    return {
      data,
      meta: {
        total: Number((total as any)?.count) || 0,
        page,
        limit,
      }
    };
  }

  /**
   * Get single ${resourceName} by ID
   */
  async getById(id: string) {
    return DB.from("${resourceName}s").where("id", id).first();
  }

  /**
   * Create new ${resourceName}
   */
  async create(data: Record<string, any>) {
    const now = dayjs().valueOf();
    const record = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    await DB.table("${resourceName}s").insert(record);
    Logger.info('${className} created', { id: record.id });
    
    return record;
  }

  /**
   * Update ${resourceName}
   */
  async update(id: string, data: Record<string, any>) {
    const payload = {
      ...data,
      updated_at: dayjs().valueOf(),
    };

    await DB.from("${resourceName}s").where("id", id).update(payload);
    Logger.info('${className} updated', { id });
    
    return this.getById(id);
  }

  /**
   * Delete ${resourceName}
   */
  async delete(id: string) {
    const deleted = await DB.from("${resourceName}s").where("id", id).delete();
    
    if (deleted) {
      Logger.info('${className} deleted', { id });
    }
    
    return deleted > 0;
  }
}

export default new ${className}Service();
`;
   }
}

export default new MakeService();
