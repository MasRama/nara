/**
 * Resource template generator — scaffolds a full-stack resource.
 *
 * Usage:
 *   npx ts-node scripts/gen-resource.ts products
 *   npx ts-node scripts/gen-resource.ts posts --fields="title:string,body:text"
 *   npm run gen:resource products
 *
 * Generates a full-stack resource following all AGENTS.md conventions:
 *   1. app/types/models.ts           → interface (appended)
 *   2. migrations/NNNN_*.ts          → CREATE TABLE
 *   3. app/queries/<name>.ts         → CRUD query functions
 *   4. app/validators/schemas.ts     → Create<Resource>Schema (appended)
 *   5. app/validators/index.ts       → barrel exports (updated)
 *   6. app/handlers/<name>.ts        → page + list + add + edit + remove handlers
 *   7. routes/web.ts                 → route entries (appended)
 *   8. resources/Pages/<name>.svelte → table + form page
 *   9. app/handlers/index.ts         → barrel export (updated)
 *  10. app/queries/index.ts          → barrel export (updated)
 *  11. tests/handlers/<name>.test.ts → handler test stub with pre-wired mocks
 *
 * All names follow ADR 0009 (descriptive handler names).
 * All SQL follows ADR 0001 (raw SQL, no ORM).
 * All functions follow ADR 0002 (functions, no classes).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

interface Field {
  name: string;
  type: 'string' | 'text' | 'number' | 'boolean';
}

function parseFields(arg: string | undefined): Field[] {
  if (!arg) return [];
  return arg.split(',').map(f => {
    const [name, type] = f.split(':');
    return { name: name.trim(), type: (type || 'string').trim() as Field['type'] };
  });
}

function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function toPascal(s: string): string {
  return s.split(/[_-]/).map(capitalize).join('');
}

function toCamel(s: string): string {
  const pascal = toPascal(s);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function tsType(fieldType: Field['type']): string {
  switch (fieldType) {
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'text': return 'string';
    case 'string': return 'string';
  }
}

function sqlType(fieldType: Field['type']): string {
  switch (fieldType) {
    case 'number': return 'INTEGER';
    case 'boolean': return 'INTEGER';
    case 'text': return 'TEXT';
    case 'string': return 'TEXT';
  }
}

function timestamp(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
}

function generateInterface(name: string, fields: Field[]): string {
  const singular = toPascal(singularize(name));
  const fieldLines = fields.map(f => `  ${f.name}: ${tsType(f.type)};`).join('\n');
  return `
export interface ${singular} {
  id: string;
${fieldLines}
  created_at: number;
  updated_at: number;
}
`;
}

function generateMigration(name: string, fields: Field[]): string {
  const tableName = name.toLowerCase();
  const fieldLines = fields.map(f => `  ${f.name} ${sqlType(f.type)},`).join('\n');

  return `export const up = \`
CREATE TABLE IF NOT EXISTS ${tableName} (
  id TEXT PRIMARY KEY NOT NULL,
${fieldLines}
  created_at INTEGER,
  updated_at INTEGER
);
\`;

export const down = \`
DROP TABLE IF EXISTS ${tableName};
\`;
`;
}

function generateQueries(name: string, fields: Field[]): string {
  const singular = toPascal(singularize(name));
  const camelSingular = toCamel(singularize(name));
  const tableName = name.toLowerCase();
  const fieldNames = fields.map(f => f.name);
  const insertFields = ['id', ...fieldNames, 'created_at', 'updated_at'];

  return `import SQLite from '@services/SQLite';
import type { ${singular} } from '@types';

export const find${singular}ById = (id: string): ${singular} | undefined =>
  SQLite.one<${singular}>\`SELECT * FROM ${tableName} WHERE id = \${id}\`;

export const create${singular} = (data: { id: string; ${fieldNames.map(n => `${n}: ${tsType(fields.find(f => f.name === n)!.type)}`).join('; ')} }): ${singular} => {
  const now = Date.now();
  SQLite.exec\`
    INSERT INTO ${tableName} (${insertFields.join(', ')})
    VALUES (\${data.id}, ${fieldNames.map(n => `\${data.${n}}`).join(', ')}, \${now}, \${now})
  \`;
  return find${singular}ById(data.id)!;
};

export const get${singular}sPaginated = (page: number, limit: number, search = ''): { data: ${singular}[]; total: number } => {
  const offset = (page - 1) * limit;
  const pattern = \`%\${search}%\`;
  const countRow = SQLite.one<{ count: number }>\`
    SELECT COUNT(*) as count FROM ${tableName} WHERE ${fieldNames[0] || 'id'} LIKE \${pattern}
  \`;
  const data = SQLite.many<${singular}>\`
    SELECT * FROM ${tableName} WHERE ${fieldNames[0] || 'id'} LIKE \${pattern}
    ORDER BY created_at DESC LIMIT \${limit} OFFSET \${offset}
  \`;
  return { data, total: countRow?.count ?? 0 };
};

export const update${singular} = (id: string, data: Partial<Omit<${singular}, 'id' | 'created_at'>>): ${singular} | undefined => {
  const { id: _id, created_at: _created_at, ...rest } = data as Record<string, unknown>;
  SQLite.update('${tableName}', { id }, rest);
  return find${singular}ById(id);
};

export const delete${singular}s = (ids: string[]): void => {
  if (ids.length === 0) return;
  SQLite.exec\`DELETE FROM ${tableName} WHERE id IN (\${ids})\`;
};
`;
}

function generateHandlers(name: string, fields: Field[]): string {
  const singular = toPascal(singularize(name));
  const camelSingular = toCamel(singularize(name));
  const camelPlural = toCamel(name);
  const tableName = name.toLowerCase();
  const fieldNames = fields.map(f => f.name);

  return `import type { NaraRequest, NaraResponse } from '@core';
import { jsonSuccess, jsonCreated, jsonError, jsonServerError, jsonValidationError, jsonPaginated, queryInt, queryString } from '@core';
import { randomUUID } from 'crypto';
import Logger from '@services/Logger';
import { find${singular}ById, create${singular}, get${singular}sPaginated, update${singular}, delete${singular}s } from '@queries';
import { Create${singular}Schema, zodToErrors } from '@validators';

export const ${camelPlural}Page = (req: NaraRequest, res: NaraResponse) => {
  const page = queryInt(req, 'page');
  const limit = queryInt(req, 'limit', 10);
  const search = queryString(req, 'search');
  const result = get${singular}sPaginated(page, limit, search);
  return res.inertia('${camelPlural}', {
    ${camelPlural}: result.data,
    total: result.total, page, limit,
  });
};

export const list${singular}s = (req: NaraRequest, res: NaraResponse) => {
  const page = queryInt(req, 'page');
  const limit = queryInt(req, 'limit', 10);
  const search = queryString(req, 'search');
  const result = get${singular}sPaginated(page, limit, search);
  return jsonPaginated(res, 'OK', result.data, {
    total: result.total, page, limit,
    totalPages: Math.ceil(result.total / limit),
    hasNext: page * limit < result.total,
    hasPrev: page > 1,
  });
};

export const add${singular} = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const parsed = Create${singular}Schema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
  try {
    const item = create${singular}({ id: randomUUID(), ...parsed.data });
    return jsonCreated(res, '${singular} created', { item });
  } catch (error: unknown) {
    Logger.error('Failed to create ${camelSingular}', error as Error);
    return jsonServerError(res, 'Failed to create ${camelSingular}');
  }
};

export const edit${singular} = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const id = req.params.id;
  if (!id) return jsonError(res, 'ID required', 400);
  const parsed = Create${singular}Schema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
  try {
    const item = update${singular}(id, parsed.data);
    return jsonSuccess(res, '${singular} updated', { item });
  } catch (error: unknown) {
    Logger.error('Failed to update ${camelSingular}', error as Error);
    return jsonServerError(res, 'Failed to update ${camelSingular}');
  }
};

export const remove${singular}s = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const ids = req.body.ids as string[];
  if (!ids || !Array.isArray(ids)) return jsonError(res, 'IDs required', 400);
  try {
    delete${singular}s(ids);
    return jsonSuccess(res, '${singular}s deleted');
  } catch (error: unknown) {
    Logger.error('Failed to delete ${camelPlural}', error as Error);
    return jsonServerError(res, 'Failed to delete ${camelSingular}');
  }
};
`;
}

function generateRoutes(name: string): string {
  const camelPlural = toCamel(name);
  const singular = toCamel(singularize(name));

  return `
// ${capitalize(camelPlural)}
Route.get('/${camelPlural}', [Auth], ${camelPlural}.${camelPlural}Page);
Route.get('/${camelPlural}/data', [Auth], ${camelPlural}.list${toPascal(singularize(name))}s);
Route.post('/${camelPlural}', [Auth], ${camelPlural}.add${toPascal(singularize(name))});
Route.put('/${camelPlural}/:id', [Auth], ${camelPlural}.edit${toPascal(singularize(name))});
Route.delete('/${camelPlural}', [Auth], ${camelPlural}.remove${toPascal(singularize(name))}s);
`;
}

function generatePage(name: string): string {
  const singular = toPascal(singularize(name));
  const camelPlural = toCamel(name);
  const camelSingular = toCamel(singularize(name));

  return `<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import axios from 'axios';
  import { api } from '$lib/api';
  import type { ${singular}, PaginationMeta, User } from '../types';
  import Button from '../Components/Button.svelte';

  interface Props {
    ${camelPlural}?: ${singular}[];
    total?: number;
    page?: number;
    limit?: number;
  }

  let { ${camelPlural} = [], total = 0, page = 1, limit = 10 }: Props = $props();
  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  let items = $state<${singular}[]>(${camelPlural});
  let isLoading = $state(false);

  async function loadData(): Promise<void> {
    const result = await api(() => axios.get('/${camelPlural}/data'), { showSuccessToast: false });
    if (result.success) items = result.data;
  }

  $effect(() => { loadData(); });
</script>

<Header group="${camelPlural}" />

<div class="min-h-[100dvh] bg-background text-foreground font-body">
  <section class="px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <h1 class="text-3xl font-heading font-bold">${capitalize(camelPlural)}</h1>
    <p class="text-muted-foreground mt-2">{total} total</p>

    <div class="mt-8 border rounded-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="text-left p-3 font-heading">ID</th>
            <th class="text-left p-3 font-heading">Created</th>
          </tr>
        </thead>
        <tbody>
          {#each items as item (item.id)}
            <tr class="border-t hover:bg-muted/30">
              <td class="p-3 font-mono text-xs">{item.id}</td>
              <td class="p-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</div>
`;
}

function generateValidator(name: string, fields: Field[]): string {
  const singular = toPascal(singularize(name));
  const fieldLines = fields.map(f => {
    if (f.type === 'number') return `  ${f.name}: z.number(),`;
    if (f.type === 'boolean') return `  ${f.name}: z.boolean(),`;
    if (f.type === 'text') return `  ${f.name}: z.string().min(1),`;
    return `  ${f.name}: z.string().min(1),`;
  }).join('\n');

  return `
export const Create${singular}Schema = z.object({
${fieldLines}
});
export type Create${singular}Input = z.infer<typeof Create${singular}Schema>;
`;
}

function generateTest(name: string, fields: Field[]): string {
  const singular = toPascal(singularize(name));
  const camelSingular = toCamel(singularize(name));
  const camelPlural = toCamel(name);
  const firstField = fields[0];
  const sampleBody = firstField
    ? `{ ${firstField.name}: ${firstField.type === 'number' ? '42' : firstField.type === 'boolean' ? 'true' : "'test'"} }`
    : '{}';

  return `/**
 * Handler tests — ${camelPlural}.ts
 *
 * Pattern mirrors tests/handlers/roles.test.ts:
 * 1. Mock @queries/${camelPlural} + @queries (handlers depend on queries, not real DB)
 * 2. Use mockRequest/mockResponse from tests/helpers/mocks
 * 3. Call handler, assert _status + _body
 * 4. Cover: auth guard, validation, happy path, error path
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';

vi.mock('@queries/${camelPlural}', () => ({
  find${singular}ById: vi.fn(),
  create${singular}: vi.fn(),
  get${singular}sPaginated: vi.fn(() => ({ data: [], total: 0 })),
  update${singular}: vi.fn(),
  delete${singular}s: vi.fn(() => undefined),
}));

vi.mock('@queries/users', () => ({
  isAdmin: vi.fn(() => false),
  hasPermission: vi.fn(() => false),
}));

vi.mock('@queries', () => ({
  findSessionById: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock('@services/Logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { list${singular}s, add${singular}, edit${singular}, remove${singular}s } from '../../app/handlers/${camelPlural}';
import { create${singular}, update${singular}, delete${singular}s } from '@queries/${camelPlural}';
import { isAdmin, hasPermission } from '@queries/users';

describe('${camelPlural} handler', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('list${singular}s', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest();
      const res = mockResponse();
      list${singular}s(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns paginated data', () => {
      const req = mockRequest({ user: mockUser() });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      list${singular}s(req as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body.success).toBe(true);
    });
  });

  describe('add${singular}', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest({ body: ${sampleBody} });
      const res = mockResponse();
      add${singular}(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns 422 if validation fails', () => {
      const req = mockRequest({ user: mockUser(), body: {} });
      const res = mockResponse();
      add${singular}(req as any, res as any);
      expect(res._status).toBe(422);
    });

    it('creates ${camelSingular} and returns 201', () => {
      const req = mockRequest({ user: mockUser(), body: ${sampleBody} });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      (create${singular} as any).mockReturnValue({ id: 'test-id', created_at: Date.now(), updated_at: Date.now() });
      add${singular}(req as any, res as any);
      expect(res._status).toBe(201);
      expect(res._body.success).toBe(true);
    });
  });

  describe('remove${singular}s', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest();
      const res = mockResponse();
      remove${singular}s(req as any, res as any);
      expect(res._status).toBe(401);
    });

    it('returns 400 if no ids', () => {
      const req = mockRequest({ user: mockUser() });
      const res = mockResponse();
      remove${singular}s(req as any, res as any);
      expect(res._status).toBe(400);
    });
  });
});
`;
}

function appendToFile(filePath: string, content: string): void {
  const full = path.join(ROOT, filePath);
  if (fs.existsSync(full)) {
    fs.appendFileSync(full, content + '\n');
  } else {
    fs.writeFileSync(full, content + '\n');
  }
}

function updateAgentsStructureTable(agentsFile: string, fileName: string, purpose: string): void {
  const fullPath = path.join(ROOT, agentsFile);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf-8');
  // Skip if already mentioned
  if (content.includes(`\`${fileName}\``)) return;
  // Insert before the `index.ts` row (or before the first blank line after the table header)
  const indexRowRegex = /(\| `index\.ts` \|[^\n]*\n)/;
  const newRow = `| \`${fileName}\` | ${purpose} |\n`;
  if (indexRowRegex.test(content)) {
    content = content.replace(indexRowRegex, newRow + '$1');
  } else {
    // Fallback: insert after the last table row before a blank line
    content = content.replace(/(\|[^\n]*\|\n)(\n)/, `$1${newRow}\n`);
  }
  fs.writeFileSync(fullPath, content);
}

function writeFileSync(filePath: string, content: string): void {
  const full = path.join(ROOT, filePath);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content);
}

function main(): void {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: npm run gen:resource <name> [--fields="name:type,..."]');
    console.error('Example: npm run gen:resource products --fields="name:string,price:number"');
    process.exit(1);
  }

  const fieldsArg = process.argv.find(a => a.startsWith('--fields='));
  const fields = parseFields(fieldsArg?.split('=')[1]);

  if (fields.length === 0) {
    console.error('Error: --fields is required. Example: --fields="name:string,price:number"');
    process.exit(1);
  }

  const singular = toPascal(singularize(name));
  const camelSingular = toCamel(singularize(name));
  const camelPlural = toCamel(name);
  const ts = timestamp();

  console.log(`\nGenerating resource: ${name} (${fields.length} fields)\n`);

  // 1. Types — append to models.ts
  const typesContent = generateInterface(name, fields);
  appendToFile('app/types/models.ts', typesContent);
  console.log(`  ✓ app/types/models.ts (appended interface ${singular})`);

  // 2. Migration
  const migrationFile = `migrations/${ts}_create_${name.toLowerCase()}.ts`;
  writeFileSync(migrationFile, generateMigration(name, fields));
  console.log(`  ✓ ${migrationFile}`);

  // 3. Queries
  const queriesFile = `app/queries/${camelPlural}.ts`;
  writeFileSync(queriesFile, generateQueries(name, fields));
  console.log(`  ✓ ${queriesFile}`);

  // 3b. Update queries AGENTS.md Structure table
  updateAgentsStructureTable('app/queries/AGENTS.md', `${camelPlural}.ts`, `CRUD + pagination for ${camelPlural}`);
  console.log(`  ✓ app/queries/AGENTS.md (added Structure row)`);

  // 4. Validator — append to schemas.ts
  const validatorContent = generateValidator(name, fields);
  appendToFile('app/validators/schemas.ts', validatorContent);
  console.log(`  ✓ app/validators/schemas.ts (appended Create${singular}Schema)`);

  // 4b. Update validators index.ts — add to both value and type export blocks
  const validatorsIndexPath = path.join(ROOT, 'app/validators/index.ts');
  if (fs.existsSync(validatorsIndexPath)) {
    let vIndex = fs.readFileSync(validatorsIndexPath, 'utf-8');
    const schemaExport = `Create${singular}Schema`;
    const typeExport = `Create${singular}Input`;
    let modified = false;

    // Add to value export block: after the last "  XxxSchema," line, before "} from './schemas';"
    if (!vIndex.includes(`  ${schemaExport},`)) {
      vIndex = vIndex.replace(
        /(  \w+Schema,\n)(} from '\.\/schemas';)/,
        `$1  ${schemaExport},\n$2`
      );
      modified = true;
    }

    // Add to type export block: after the last "  XxxInput," line, before "} from './schemas';"
    if (!vIndex.includes(`  ${typeExport},`)) {
      vIndex = vIndex.replace(
        /(  \w+Input,\n)(} from '\.\/schemas';)/,
        `$1  ${typeExport},\n$2`
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(validatorsIndexPath, vIndex);
      console.log(`  ✓ app/validators/index.ts (added exports)`);
    }
  }

  // 5. Handlers
  const handlerFile = `app/handlers/${camelPlural}.ts`;
  writeFileSync(handlerFile, generateHandlers(name, fields));
  console.log(`  ✓ ${handlerFile}`);

  // 5b. Update handlers AGENTS.md Structure table
  updateAgentsStructureTable('app/handlers/AGENTS.md', `${camelPlural}.ts`, `${camelSingular} page + list + add + edit + remove`);
  console.log(`  ✓ app/handlers/AGENTS.md (added Structure row)`);

  // 6. Routes — append import + routes to web.ts (before export)
  const routesFile = 'routes/web.ts';
  const routesContent = generateRoutes(name);
  const routePath = path.join(ROOT, routesFile);
  let routeSrc = fs.readFileSync(routePath, 'utf-8');

  // Add handler import if missing
  const importLine = `import * as ${camelPlural} from '@handlers/${camelPlural}';`;
  if (!routeSrc.includes(importLine)) {
    // Insert after the last existing @handlers import
    const handlerImportRegex = /import\s+\*\s+as\s+\w+\s+from\s+['"]@handlers\/\w+['"];?\n/g;
    const matches = [...routeSrc.matchAll(handlerImportRegex)];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const insertAt = lastMatch.index! + lastMatch[0].length;
      routeSrc = routeSrc.slice(0, insertAt) + importLine + '\n' + routeSrc.slice(insertAt);
    } else {
      routeSrc = importLine + '\n' + routeSrc;
    }
  }

  routeSrc = routeSrc.replace('export default Route.getRouter();', routesContent + '\nexport default Route.getRouter();');
  fs.writeFileSync(routePath, routeSrc);
  console.log(`  ✓ ${routesFile} (appended ${camelPlural} routes)`);

  // 7. Page
  const pageFile = `resources/Pages/${camelPlural}.svelte`;
  writeFileSync(pageFile, generatePage(name));
  console.log(`  ✓ ${pageFile}`);

  // 7b. Update Pages AGENTS.md Structure table
  updateAgentsStructureTable('resources/Pages/AGENTS.md', `${camelPlural}.svelte`, `${camelPlural} management (CRUD table)`);
  console.log(`  ✓ resources/Pages/AGENTS.md (added Structure row)`);

  // 8. Test file
  const testFile = `tests/handlers/${camelPlural}.test.ts`;
  writeFileSync(testFile, generateTest(name, fields));
  console.log(`  ✓ ${testFile}`);

  // 9. Update handler index
  const indexPath = path.join(ROOT, 'app/handlers/index.ts');
  let indexContent = fs.readFileSync(indexPath, 'utf-8');
  if (!indexContent.includes(`'./${camelPlural}'`)) {
    indexContent = indexContent.trimEnd() + `\nexport * as ${camelPlural} from './${camelPlural}';\n`;
    fs.writeFileSync(indexPath, indexContent);
    console.log(`  ✓ app/handlers/index.ts (added export)`);
  }

  // 10. Update queries index
  const queriesIndexPath = path.join(ROOT, 'app/queries/index.ts');
  if (fs.existsSync(queriesIndexPath)) {
    let qIndex = fs.readFileSync(queriesIndexPath, 'utf-8');
    if (!qIndex.includes(`'./${camelPlural}'`)) {
      qIndex = qIndex.trimEnd() + `\nexport * from './${camelPlural}';\n`;
      fs.writeFileSync(queriesIndexPath, qIndex);
      console.log(`  ✓ app/queries/index.ts (added export)`);
    }
  }

  console.log(`\n✓ Resource "${name}" generated successfully.`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review generated files and customize fields`);
  console.log(`  2. Run: npm run migrate`);
  console.log(`  3. Run: npm run check`);
}

main();
