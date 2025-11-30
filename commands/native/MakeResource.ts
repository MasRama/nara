import * as fs from "fs";
import * as path from "path";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class MakeResource {
  public args: string[] = [];
  public commandName = "make:resource";
  public description = "Create a complete resource (controller, validator, routes)";

  public async run() {
    if (this.args.length < 2) {
      printError("Resource name is required.");
      console.log(`\n${c.dim}Usage: node nara make:resource <name> [options]${c.reset}`);
      console.log(`${c.dim}Example: node nara make:resource Post${c.reset}`);
      console.log(`\n${c.yellow}Options:${c.reset}`);
      console.log(`  ${c.dim}--api         Generate API-only routes (no Inertia pages)${c.reset}`);
      console.log(`  ${c.dim}--with-pages  Generate Svelte+Inertia page skeletons${c.reset}`);
      console.log();
      return;
    }

    let name = this.args[1];
    const apiOnly = this.args.includes('--api');
    const withPages = this.args.includes('--with-pages');
    
    // Clean up name and ensure proper casing
    name = name.replace(/controller$/i, "").replace(/schema$/i, "");
    const pascalName = name.charAt(0).toUpperCase() + name.slice(1);
    const lowerName = name.toLowerCase();
    const pluralName = lowerName + 's';

    console.log();
    printInfo(`Creating resource: ${c.cyan}${pascalName}${c.reset}`);
    console.log();

    // 1. Create Controller
    const controllerCreated = this.createController(pascalName, lowerName, pluralName, apiOnly);
    
    // 2. Create Validators
    const validatorCreated = this.createValidators(pascalName, lowerName);
    
    // 3. Generate Route Snippet
    this.generateRouteSnippet(pascalName, lowerName, pluralName, apiOnly);
    
    // 4. Create Svelte Pages (optional)
    if (withPages && !apiOnly) {
      this.createSveltePages(pascalName, lowerName, pluralName);
    }

    console.log();
    printSuccess(`Resource ${c.cyan}${pascalName}${c.reset} created successfully!`);
    console.log();
    
    // Summary
    console.log(`${c.yellow}${c.bright}Next Steps:${c.reset}`);
    console.log(`  ${c.dim}1. Add the route snippet to ${c.cyan}routes/web.ts${c.reset}`);
    console.log(`  ${c.dim}2. Export validators in ${c.cyan}app/validators/index.ts${c.reset}`);
    console.log(`  ${c.dim}3. Create migration: ${c.cyan}node nara make:migration create_${pluralName}_table${c.reset}`);
    if (withPages) {
      console.log(`  ${c.dim}4. Customize Svelte pages in ${c.cyan}resources/js/Pages/${pascalName}/${c.reset}`);
    }
    console.log();
  }

  private createController(pascalName: string, lowerName: string, pluralName: string, apiOnly: boolean): boolean {
    const className = pascalName + "Controller";
    const filename = className + ".ts";
    const filepath = "./app/controllers/" + filename;

    if (fs.existsSync(filepath)) {
      printInfo(`Controller already exists: ${c.dim}${filepath}${c.reset}`);
      return false;
    }

    fs.writeFileSync(filepath, this.getControllerTemplate(className, pascalName, lowerName, pluralName, apiOnly));
    printSuccess(`Created: ${c.cyan}app/controllers/${filename}${c.reset}`);
    return true;
  }

  private createValidators(pascalName: string, lowerName: string): boolean {
    const filename = lowerName + ".ts";
    const filepath = "./app/validators/" + filename;

    if (fs.existsSync(filepath)) {
      printInfo(`Validator already exists: ${c.dim}${filepath}${c.reset}`);
      return false;
    }

    fs.writeFileSync(filepath, this.getValidatorTemplate(pascalName, lowerName));
    printSuccess(`Created: ${c.cyan}app/validators/${filename}${c.reset}`);
    
    // Show export hint
    console.log(`${c.dim}  Add to app/validators/index.ts:${c.reset}`);
    console.log(`${c.dim}    export { Create${pascalName}Schema, Update${pascalName}Schema } from './${lowerName}';${c.reset}`);
    console.log(`${c.dim}    export type { Create${pascalName}Input, Update${pascalName}Input } from './${lowerName}';${c.reset}`);
    
    return true;
  }

  private generateRouteSnippet(pascalName: string, lowerName: string, pluralName: string, apiOnly: boolean) {
    const controllerName = pascalName + "Controller";
    
    console.log();
    console.log(`${c.yellow}${c.bright}Route Snippet (add to routes/web.ts):${c.reset}`);
    console.log(`${c.dim}─────────────────────────────────────────${c.reset}`);
    
    if (apiOnly) {
      console.log(`${c.cyan}// Import at top of file${c.reset}`);
      console.log(`import ${controllerName} from "@controllers/${controllerName}";`);
      console.log();
      console.log(`${c.cyan}// ${pascalName} API Routes${c.reset}`);
      console.log(`Route.get("/api/${pluralName}", [Auth], ${controllerName}.index);`);
      console.log(`Route.get("/api/${pluralName}/:id", [Auth], ${controllerName}.show);`);
      console.log(`Route.post("/api/${pluralName}", [Auth], ${controllerName}.store);`);
      console.log(`Route.put("/api/${pluralName}/:id", [Auth], ${controllerName}.update);`);
      console.log(`Route.delete("/api/${pluralName}/:id", [Auth], ${controllerName}.destroy);`);
    } else {
      console.log(`${c.cyan}// Import at top of file${c.reset}`);
      console.log(`import ${controllerName} from "@controllers/${controllerName}";`);
      console.log();
      console.log(`${c.cyan}// ${pascalName} Routes${c.reset}`);
      console.log(`Route.get("/${pluralName}", [Auth], ${controllerName}.index);`);
      console.log(`Route.get("/${pluralName}/create", [Auth], ${controllerName}.create);`);
      console.log(`Route.get("/${pluralName}/:id", [Auth], ${controllerName}.show);`);
      console.log(`Route.get("/${pluralName}/:id/edit", [Auth], ${controllerName}.edit);`);
      console.log(`Route.post("/${pluralName}", [Auth], ${controllerName}.store);`);
      console.log(`Route.put("/${pluralName}/:id", [Auth], ${controllerName}.update);`);
      console.log(`Route.delete("/${pluralName}/:id", [Auth], ${controllerName}.destroy);`);
    }
    
    console.log(`${c.dim}─────────────────────────────────────────${c.reset}`);
  }

  private createSveltePages(pascalName: string, lowerName: string, pluralName: string) {
    const pagesDir = `./resources/js/Pages/${pascalName}`;
    
    // Create directory if not exists
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }

    // Index page
    const indexPath = path.join(pagesDir, "Index.svelte");
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, this.getIndexPageTemplate(pascalName, lowerName, pluralName));
      printSuccess(`Created: ${c.cyan}resources/js/Pages/${pascalName}/Index.svelte${c.reset}`);
    }

    // Create page
    const createPath = path.join(pagesDir, "Create.svelte");
    if (!fs.existsSync(createPath)) {
      fs.writeFileSync(createPath, this.getCreatePageTemplate(pascalName, lowerName, pluralName));
      printSuccess(`Created: ${c.cyan}resources/js/Pages/${pascalName}/Create.svelte${c.reset}`);
    }

    // Edit page
    const editPath = path.join(pagesDir, "Edit.svelte");
    if (!fs.existsSync(editPath)) {
      fs.writeFileSync(editPath, this.getEditPageTemplate(pascalName, lowerName, pluralName));
      printSuccess(`Created: ${c.cyan}resources/js/Pages/${pascalName}/Edit.svelte${c.reset}`);
    }

    // Show page
    const showPath = path.join(pagesDir, "Show.svelte");
    if (!fs.existsSync(showPath)) {
      fs.writeFileSync(showPath, this.getShowPageTemplate(pascalName, lowerName));
      printSuccess(`Created: ${c.cyan}resources/js/Pages/${pascalName}/Show.svelte${c.reset}`);
    }
  }

  private getControllerTemplate(className: string, pascalName: string, lowerName: string, pluralName: string, apiOnly: boolean): string {
    if (apiOnly) {
      return this.getApiControllerTemplate(className, pascalName, lowerName, pluralName);
    }
    return this.getInertiaControllerTemplate(className, pascalName, lowerName, pluralName);
  }

  private getApiControllerTemplate(className: string, pascalName: string, lowerName: string, pluralName: string): string {
    return `/**
 * ${className}
 * 
 * API Controller for ${lowerName} resource.
 */
import DB from "@services/DB";
import Logger from "@services/Logger";
import { validateOrFail, Create${pascalName}Schema, Update${pascalName}Schema } from "@validators";
import { PAGINATION, ERROR_MESSAGES } from "@config";
import { Request, Response } from "@type";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

class ${className} {
  /**
   * Display a listing of the resource.
   */
  public async index(request: Request, response: Response) {
    const page = parseInt(request.query.page as string) || 1;
    const limit = Math.min(parseInt(request.query.limit as string) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const search = request.query.search as string || "";

    let query = DB.from("${pluralName}").select("*");

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

    return response.json({
      success: true,
      data,
      meta: {
        total: Number((total as any)?.count) || 0,
        page,
        limit,
        totalPages: Math.ceil(Number((total as any)?.count) / limit) || 1,
      }
    });
  }

  /**
   * Display the specified resource.
   */
  public async show(request: Request, response: Response) {
    const { id } = request.params;

    const record = await DB.from("${pluralName}").where("id", id).first();

    if (!record) {
      return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
    }

    return response.json({ success: true, data: record });
  }

  /**
   * Store a newly created resource.
   */
  public async store(request: Request, response: Response) {
    if (!request.user) {
      return response.status(401).json({ success: false, message: "Unauthorized" });
    }

    const rawData = await request.json();
    const data = await validateOrFail(Create${pascalName}Schema, rawData, response);
    if (!data) return;

    const now = dayjs().valueOf();
    const record = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    try {
      await DB.table("${pluralName}").insert(record);
      Logger.info('${pascalName} created', { id: record.id, userId: request.user.id });
      return response.status(201).json({ success: true, message: "Data berhasil dibuat", data: record });
    } catch (error: any) {
      Logger.error('Failed to create ${lowerName}', error);
      return response.status(500).json({ success: false, message: "Gagal membuat data" });
    }
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
    const data = await validateOrFail(Update${pascalName}Schema, rawData, response);
    if (!data) return;

    const existing = await DB.from("${pluralName}").where("id", id).first();
    if (!existing) {
      return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
    }

    const payload = {
      ...data,
      updated_at: dayjs().valueOf(),
    };

    try {
      await DB.from("${pluralName}").where("id", id).update(payload);
      const record = await DB.from("${pluralName}").where("id", id).first();
      Logger.info('${pascalName} updated', { id, userId: request.user.id });
      return response.json({ success: true, message: "Data berhasil diupdate", data: record });
    } catch (error: any) {
      Logger.error('Failed to update ${lowerName}', error);
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
      const deleted = await DB.from("${pluralName}").where("id", id).delete();
      
      if (!deleted) {
        return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
      }

      Logger.info('${pascalName} deleted', { id, userId: request.user.id });
      return response.json({ success: true, message: "Data berhasil dihapus" });
    } catch (error: any) {
      Logger.error('Failed to delete ${lowerName}', error);
      return response.status(500).json({ success: false, message: "Gagal menghapus data" });
    }
  }
}

export default new ${className}();
`;
  }

  private getInertiaControllerTemplate(className: string, pascalName: string, lowerName: string, pluralName: string): string {
    return `/**
 * ${className}
 * 
 * Controller for ${lowerName} resource with Inertia.js views.
 */
import DB from "@services/DB";
import Logger from "@services/Logger";
import { validateOrFail, Create${pascalName}Schema, Update${pascalName}Schema } from "@validators";
import { PAGINATION, ERROR_MESSAGES } from "@config";
import { Request, Response } from "@type";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

class ${className} {
  /**
   * Display a listing of the resource.
   */
  public async index(request: Request, response: Response) {
    const page = parseInt(request.query.page as string) || 1;
    const limit = Math.min(parseInt(request.query.limit as string) || PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
    const search = request.query.search as string || "";

    let query = DB.from("${pluralName}").select("*");

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

    return (response as any).inertia("${pascalName}/Index", {
      ${pluralName}: data,
      meta: {
        total: Number((total as any)?.count) || 0,
        page,
        limit,
        totalPages: Math.ceil(Number((total as any)?.count) / limit) || 1,
        search,
      }
    });
  }

  /**
   * Show the form for creating a new resource.
   */
  public async create(request: Request, response: Response) {
    return (response as any).inertia("${pascalName}/Create");
  }

  /**
   * Display the specified resource.
   */
  public async show(request: Request, response: Response) {
    const { id } = request.params;

    const record = await DB.from("${pluralName}").where("id", id).first();

    if (!record) {
      return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
    }

    return (response as any).inertia("${pascalName}/Show", { ${lowerName}: record });
  }

  /**
   * Show the form for editing the specified resource.
   */
  public async edit(request: Request, response: Response) {
    const { id } = request.params;

    const record = await DB.from("${pluralName}").where("id", id).first();

    if (!record) {
      return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
    }

    return (response as any).inertia("${pascalName}/Edit", { ${lowerName}: record });
  }

  /**
   * Store a newly created resource.
   */
  public async store(request: Request, response: Response) {
    if (!request.user) {
      return response.status(401).json({ success: false, message: "Unauthorized" });
    }

    const rawData = await request.json();
    const data = await validateOrFail(Create${pascalName}Schema, rawData, response);
    if (!data) return;

    const now = dayjs().valueOf();
    const record = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    try {
      await DB.table("${pluralName}").insert(record);
      Logger.info('${pascalName} created', { id: record.id, userId: request.user.id });
      return response.json({ success: true, message: "Data berhasil dibuat", data: record });
    } catch (error: any) {
      Logger.error('Failed to create ${lowerName}', error);
      return response.status(500).json({ success: false, message: "Gagal membuat data" });
    }
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
    const data = await validateOrFail(Update${pascalName}Schema, rawData, response);
    if (!data) return;

    const existing = await DB.from("${pluralName}").where("id", id).first();
    if (!existing) {
      return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
    }

    const payload = {
      ...data,
      updated_at: dayjs().valueOf(),
    };

    try {
      await DB.from("${pluralName}").where("id", id).update(payload);
      const record = await DB.from("${pluralName}").where("id", id).first();
      Logger.info('${pascalName} updated', { id, userId: request.user.id });
      return response.json({ success: true, message: "Data berhasil diupdate", data: record });
    } catch (error: any) {
      Logger.error('Failed to update ${lowerName}', error);
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
      const deleted = await DB.from("${pluralName}").where("id", id).delete();
      
      if (!deleted) {
        return response.status(404).json({ success: false, message: ERROR_MESSAGES.NOT_FOUND });
      }

      Logger.info('${pascalName} deleted', { id, userId: request.user.id });
      return response.json({ success: true, message: "Data berhasil dihapus" });
    } catch (error: any) {
      Logger.error('Failed to delete ${lowerName}', error);
      return response.status(500).json({ success: false, message: "Gagal menghapus data" });
    }
  }
}

export default new ${className}();
`;
  }

  private getValidatorTemplate(pascalName: string, lowerName: string): string {
    return `/**
 * ${pascalName} Validation
 * 
 * Validation functions for ${lowerName} resource.
 */
import { ValidationResult, isString, isObject } from './validate';

/**
 * Create${pascalName}Input
 */
export interface Create${pascalName}Input {
  name: string;
  // Add more fields as needed
}

/**
 * Update${pascalName}Input
 */
export interface Update${pascalName}Input {
  name?: string;
  // Add more fields as needed
}

/**
 * Create${pascalName}Schema
 * 
 * Validation for creating a new ${lowerName}.
 */
export function Create${pascalName}Schema(data: unknown): ValidationResult<Create${pascalName}Input> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { name } = data as Record<string, unknown>;

  // Name validation
  if (!isString(name) || name.trim().length < 2) {
    errors.name = ['Nama minimal 2 karakter'];
  } else if (name.trim().length > 255) {
    errors.name = ['Nama maksimal 255 karakter'];
  }

  // Add more validations as needed

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name: String(name).trim(),
    }
  };
}

/**
 * Update${pascalName}Schema
 * 
 * Validation for updating an existing ${lowerName}.
 */
export function Update${pascalName}Schema(data: unknown): ValidationResult<Update${pascalName}Input> {
  const errors: Record<string, string[]> = {};
  
  if (!isObject(data)) {
    return { success: false, errors: { _root: ['Data harus berupa object'] } };
  }

  const { name } = data as Record<string, unknown>;
  const result: Update${pascalName}Input = {};

  // Name validation (optional for update)
  if (name !== undefined) {
    if (!isString(name) || name.trim().length < 2) {
      errors.name = ['Nama minimal 2 karakter'];
    } else if (name.trim().length > 255) {
      errors.name = ['Nama maksimal 255 karakter'];
    } else {
      result.name = String(name).trim();
    }
  }

  // Add more validations as needed

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: result
  };
}
`;
  }

  private getIndexPageTemplate(pascalName: string, lowerName: string, pluralName: string): string {
    return `<script>
  import { router } from '@inertiajs/svelte';
  
  export let ${pluralName} = [];
  export let meta = { total: 0, page: 1, limit: 10, search: '' };
  
  let search = meta.search || '';
  
  function handleSearch() {
    router.get('/${pluralName}', { search, page: 1 }, { preserveState: true });
  }
  
  function handleDelete(id) {
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      router.delete(\`/${pluralName}/\${id}\`);
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">${pascalName}</h1>
    <a href="/${pluralName}/create" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
      Tambah ${pascalName}
    </a>
  </div>
  
  <!-- Search -->
  <div class="mb-4">
    <form on:submit|preventDefault={handleSearch} class="flex gap-2">
      <input 
        type="text" 
        bind:value={search}
        placeholder="Cari..."
        class="border rounded px-3 py-2 flex-1"
      />
      <button type="submit" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
        Cari
      </button>
    </form>
  </div>
  
  <!-- Table -->
  <div class="bg-white shadow rounded-lg overflow-hidden">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {#each ${pluralName} as item}
          <tr>
            <td class="px-6 py-4 whitespace-nowrap">{item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <a href="/${pluralName}/{item.id}" class="text-blue-600 hover:text-blue-900 mr-3">Lihat</a>
              <a href="/${pluralName}/{item.id}/edit" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</a>
              <button on:click={() => handleDelete(item.id)} class="text-red-600 hover:text-red-900">Hapus</button>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="2" class="px-6 py-4 text-center text-gray-500">Tidak ada data</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  
  <!-- Pagination -->
  <div class="mt-4 flex justify-between items-center text-sm text-gray-600">
    <span>Total: {meta.total} data</span>
    <span>Halaman {meta.page} dari {meta.totalPages || 1}</span>
  </div>
</div>
`;
  }

  private getCreatePageTemplate(pascalName: string, lowerName: string, pluralName: string): string {
    return `<script>
  import { router } from '@inertiajs/svelte';
  
  let form = {
    name: '',
  };
  let errors = {};
  let loading = false;
  
  async function handleSubmit() {
    loading = true;
    errors = {};
    
    try {
      const response = await fetch('/${pluralName}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      const result = await response.json();
      
      if (result.success) {
        router.visit('/${pluralName}');
      } else if (result.errors) {
        errors = result.errors;
      }
    } catch (error) {
      console.error(error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl">
  <h1 class="text-2xl font-bold mb-6">Tambah ${pascalName}</h1>
  
  <form on:submit|preventDefault={handleSubmit} class="bg-white shadow rounded-lg p-6">
    <div class="mb-4">
      <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Nama</label>
      <input 
        type="text" 
        id="name"
        bind:value={form.name}
        class="w-full border rounded px-3 py-2 {errors.name ? 'border-red-500' : ''}"
      />
      {#if errors.name}
        <p class="text-red-500 text-sm mt-1">{errors.name[0]}</p>
      {/if}
    </div>
    
    <!-- Add more fields as needed -->
    
    <div class="flex gap-2">
      <button 
        type="submit" 
        disabled={loading}
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Menyimpan...' : 'Simpan'}
      </button>
      <a href="/${pluralName}" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
        Batal
      </a>
    </div>
  </form>
</div>
`;
  }

  private getEditPageTemplate(pascalName: string, lowerName: string, pluralName: string): string {
    return `<script>
  import { router } from '@inertiajs/svelte';
  
  export let ${lowerName};
  
  let form = {
    name: ${lowerName}?.name || '',
  };
  let errors = {};
  let loading = false;
  
  async function handleSubmit() {
    loading = true;
    errors = {};
    
    try {
      const response = await fetch(\`/${pluralName}/\${${lowerName}.id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      const result = await response.json();
      
      if (result.success) {
        router.visit('/${pluralName}');
      } else if (result.errors) {
        errors = result.errors;
      }
    } catch (error) {
      console.error(error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl">
  <h1 class="text-2xl font-bold mb-6">Edit ${pascalName}</h1>
  
  <form on:submit|preventDefault={handleSubmit} class="bg-white shadow rounded-lg p-6">
    <div class="mb-4">
      <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Nama</label>
      <input 
        type="text" 
        id="name"
        bind:value={form.name}
        class="w-full border rounded px-3 py-2 {errors.name ? 'border-red-500' : ''}"
      />
      {#if errors.name}
        <p class="text-red-500 text-sm mt-1">{errors.name[0]}</p>
      {/if}
    </div>
    
    <!-- Add more fields as needed -->
    
    <div class="flex gap-2">
      <button 
        type="submit" 
        disabled={loading}
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Menyimpan...' : 'Simpan'}
      </button>
      <a href="/${pluralName}" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
        Batal
      </a>
    </div>
  </form>
</div>
`;
  }

  private getShowPageTemplate(pascalName: string, lowerName: string): string {
    return `<script>
  export let ${lowerName};
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl">
  <h1 class="text-2xl font-bold mb-6">Detail ${pascalName}</h1>
  
  <div class="bg-white shadow rounded-lg p-6">
    <dl class="divide-y divide-gray-200">
      <div class="py-3 flex justify-between">
        <dt class="text-sm font-medium text-gray-500">Nama</dt>
        <dd class="text-sm text-gray-900">{${lowerName}?.name || '-'}</dd>
      </div>
      
      <!-- Add more fields as needed -->
      
      <div class="py-3 flex justify-between">
        <dt class="text-sm font-medium text-gray-500">Dibuat</dt>
        <dd class="text-sm text-gray-900">{new Date(${lowerName}?.created_at).toLocaleString('id-ID')}</dd>
      </div>
    </dl>
    
    <div class="mt-6 flex gap-2">
      <a href="/${lowerName}s/{${lowerName}?.id}/edit" class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded">
        Edit
      </a>
      <a href="/${lowerName}s" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded">
        Kembali
      </a>
    </div>
  </div>
</div>
`;
  }
}

export default new MakeResource();
