import * as fs from "fs";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeController {
   public args: string[] = [];
   public commandName = "make:controller";
   public description = "Create a new controller class";

   public run() {
      if (this.args.length < 2) {
         printError("Controller name is required.");
         console.log(`\n${c.dim}Usage: node nara make:controller <name>${c.reset}`);
         console.log(`${c.dim}Example: node nara make:controller User${c.reset}\n`);
         return;
      }

      let name = this.args[1];
      
      // Clean up name and ensure proper casing
      name = name.replace(/controller$/i, "");
      const className = name.charAt(0).toUpperCase() + name.slice(1) + "Controller";
      const filename = className + ".ts";
      const filepath = "./app/controllers/" + filename;

      if (fs.existsSync(filepath)) {
         printError(`Controller already exists: ${filepath}`);
         return;
      }

      fs.writeFileSync(filepath, this.getTemplate(className, name.toLowerCase()));
      
      printSuccess(`Controller created: ${c.cyan}app/controllers/${filename}${c.reset}`);
      printInfo(`Don't forget to register routes in ${c.cyan}routes/web.ts${c.reset}`);
      console.log();
   }

   getTemplate(className: string, resourceName: string) {
      return `/**
 * ${className}
 * 
 * Controller for ${resourceName} resource.
 */
import DB from "@services/DB";
import Logger from "@services/Logger";
import { validateOrFail } from "@validators";
import { PAGINATION, ERROR_MESSAGES, SUCCESS_MESSAGES } from "@config";
import { Request, Response } from "@type";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

class ${className} {
  /**
   * Display a listing of the resource.
   */
  public async index(request: Request, response: Response) {
    const page = parseInt(request.query.page as string) || 1;
    const search = request.query.search as string || "";

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
      .offset((page - 1) * PAGINATION.DEFAULT_PAGE_SIZE)
      .limit(PAGINATION.DEFAULT_PAGE_SIZE);

    return response.json({
      success: true,
      data,
      meta: {
        total: Number((total as any)?.count) || 0,
        page,
        limit: PAGINATION.DEFAULT_PAGE_SIZE,
      }
    });
  }

  /**
   * Store a newly created resource.
   */
  public async store(request: Request, response: Response) {
    if (!request.user) {
      return response.status(401).json({ success: false, message: "Unauthorized" });
    }

    const rawData = await request.json();
    // TODO: Add validation schema
    // const data = await validateOrFail(Create${className.replace('Controller', '')}Schema, rawData, response);
    // if (!data) return;

    const now = dayjs().valueOf();
    const record = {
      id: randomUUID(),
      ...rawData,
      created_at: now,
      updated_at: now,
    };

    try {
      await DB.table("${resourceName}s").insert(record);
      return response.json({ success: true, message: "Data berhasil dibuat", data: record });
    } catch (error: any) {
      Logger.error('Failed to create ${resourceName}', error);
      return response.status(500).json({ success: false, message: "Gagal membuat data" });
    }
  }

  /**
   * Display the specified resource.
   */
  public async show(request: Request, response: Response) {
    const { id } = request.params;

    const record = await DB.from("${resourceName}s").where("id", id).first();

    if (!record) {
      return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
    }

    return response.json({ success: true, data: record });
  }

  /**
   * Update the specified resource.
   */
  public async update(request: Request, response: Response) {
    if (!request.user) {
      return response.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { id } = request.params;
    const rawData = await request.json();
    // TODO: Add validation schema
    // const data = await validateOrFail(Update${className.replace('Controller', '')}Schema, rawData, response);
    // if (!data) return;

    const payload = {
      ...rawData,
      updated_at: dayjs().valueOf(),
    };

    try {
      await DB.from("${resourceName}s").where("id", id).update(payload);
      const record = await DB.from("${resourceName}s").where("id", id).first();
      return response.json({ success: true, message: "Data berhasil diupdate", data: record });
    } catch (error: any) {
      Logger.error('Failed to update ${resourceName}', error);
      return response.status(500).json({ success: false, message: "Gagal mengupdate data" });
    }
  }

  /**
   * Remove the specified resource.
   */
  public async destroy(request: Request, response: Response) {
    if (!request.user) {
      return response.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { id } = request.params;

    try {
      const deleted = await DB.from("${resourceName}s").where("id", id).delete();
      
      if (!deleted) {
        return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
      }

      Logger.info('${className.replace('Controller', '')} deleted', { id, userId: request.user.id });
      return response.json({ success: true, message: "Data berhasil dihapus" });
    } catch (error: any) {
      Logger.error('Failed to delete ${resourceName}', error);
      return response.status(500).json({ success: false, message: "Gagal menghapus data" });
    }
  }
}

export default new ${className}();
`;
   }
}

export default new MakeController();
