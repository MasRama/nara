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
      const modelName = className.replace('Controller', '');
      return `/**
 * ${className}
 * 
 * Controller for ${resourceName} resource.
 */
import { BaseController, jsonSuccess, jsonPaginated, jsonCreated, jsonNotFound, jsonServerError } from "@core";
import type { NaraRequest, NaraResponse } from "@core";
// TODO: Import your model after creating it with: node nara make:model ${modelName}
// import { ${modelName} } from "@models";
import DB from "@services/DB";
import Logger from "@services/Logger";
import { paginate } from "@services/Paginator";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@config";
import { randomUUID } from "crypto";

class ${className} extends BaseController {
  /**
   * Display a listing of the resource.
   */
  public async index(request: NaraRequest, response: NaraResponse) {
    const { page, limit, search } = this.getPaginationParams(request);

    // TODO: Replace with model query after creating model
    // const records = await ${modelName}.search(search);
    let query = DB.from("${resourceName}s").select("*");

    if (search) {
      query = query.where(function() {
        this.where('name', 'like', \`%\${search}%\`);
      });
    }

    const result = await paginate(query.orderBy('created_at', 'desc'), { page, limit });

    return jsonPaginated(response, SUCCESS_MESSAGES.DATA_RETRIEVED, result.data, result.meta);
  }

  /**
   * Store a newly created resource.
   */
  public async store(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);

    // TODO: Add validation schema
    // const data = await this.getBody(request, Create${modelName}Schema);
    const data = await request.json();

    try {
      // TODO: Replace with model after creating it
      // const record = await ${modelName}.create({ id: randomUUID(), ...data });
      const record = {
        id: randomUUID(),
        ...data,
      };
      await DB.table("${resourceName}s").insert(record);

      Logger.info('${modelName} created', { id: record.id, userId: request.user!.id });
      return jsonCreated(response, SUCCESS_MESSAGES.DATA_CREATED, record);
    } catch (error: any) {
      Logger.error('Failed to create ${resourceName}', error);
      return jsonServerError(response, ERROR_MESSAGES.SERVER_ERROR);
    }
  }

  /**
   * Display the specified resource.
   */
  public async show(request: NaraRequest, response: NaraResponse) {
    const { id } = request.params;

    // TODO: Replace with model after creating it
    // const record = await ${modelName}.findById(id);
    const record = await DB.from("${resourceName}s").where("id", id).first();

    if (!record) {
      return jsonNotFound(response, ERROR_MESSAGES.NOT_FOUND);
    }

    return jsonSuccess(response, SUCCESS_MESSAGES.DATA_RETRIEVED, record);
  }

  /**
   * Update the specified resource.
   */
  public async update(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);

    const { id } = request.params;
    
    // TODO: Add validation schema
    // const data = await this.getBody(request, Update${modelName}Schema);
    const data = await request.json();

    // TODO: Replace with model after creating it
    // const existing = await ${modelName}.findById(id);
    const existing = await DB.from("${resourceName}s").where("id", id).first();
    if (!existing) {
      return jsonNotFound(response, ERROR_MESSAGES.NOT_FOUND);
    }

    try {
      // TODO: Replace with model after creating it
      // const record = await ${modelName}.update(id, data);
      await DB.from("${resourceName}s").where("id", id).update(data);
      const record = await DB.from("${resourceName}s").where("id", id).first();

      Logger.info('${modelName} updated', { id, userId: request.user!.id });
      return jsonSuccess(response, SUCCESS_MESSAGES.DATA_UPDATED, record);
    } catch (error: any) {
      Logger.error('Failed to update ${resourceName}', error);
      return jsonServerError(response, ERROR_MESSAGES.SERVER_ERROR);
    }
  }

  /**
   * Remove the specified resource.
   */
  public async destroy(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);

    const { id } = request.params;

    try {
      // TODO: Replace with model after creating it
      // const deleted = await ${modelName}.delete(id);
      const deleted = await DB.from("${resourceName}s").where("id", id).delete();
      
      if (!deleted) {
        return jsonNotFound(response, ERROR_MESSAGES.NOT_FOUND);
      }

      Logger.info('${modelName} deleted', { id, userId: request.user!.id });
      return jsonSuccess(response, SUCCESS_MESSAGES.DATA_DELETED);
    } catch (error: any) {
      Logger.error('Failed to delete ${resourceName}', error);
      return jsonServerError(response, ERROR_MESSAGES.SERVER_ERROR);
    }
  }
}

export default new ${className}();
`;
   }
}

export default new MakeController();
