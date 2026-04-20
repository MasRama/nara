# Nara Commands

CLI code generators and database utilities for scaffolding Nara applications.

## Command Pattern

New commands follow a simple class pattern with `commandName`, `description`, and `run()`:

```typescript
class MakeExample {
  public args: string[] = [];
  public commandName = "make:example";
  public description = "Create a new example file";

  public run() { /* parse args, generate file */ }
}
export default new MakeExample();
```
Register in `commands/index.ts`.

## Controller Template Notes

`make:controller` generates an **API-only controller** (all methods return JSON via `jsonSuccess/jsonCreated/etc`).

This is intentional — the controller is meant to serve `fetch()` calls from Svelte pages, NOT to render pages directly.

**If you need an Inertia page route**, add a separate method that calls `res.inertia()`:

```typescript
// Add this method manually after generating — it renders the HTML page shell
public async page(req: NaraRequest, res: NaraResponse) {
  this.requireInertia(res);
  return res.inertia("posts/Index"); // no data here — Svelte fetches via fetch()
}
```

Then register BOTH routes:
```typescript
// routes/web.ts
Route.get('/posts', [], PostController.page);          // Inertia: renders page
Route.get('/posts/data', [Auth], PostController.index); // JSON: fetch() for data
Route.post('/posts', [Auth], PostController.store);     // JSON: fetch() to create
```

**NEVER** add `res.inertia()` to the auto-generated `index/store/update/destroy` methods — they are JSON endpoints.

## Available Commands

### Generators
| Command | Output |
|---------|--------|
| `make:controller` | `app/controllers/<Name>Controller.ts` (API/JSON only) |
| `make:model` | `app/models/<Name>.ts` |
| `make:migration` | Knex migration file |
| `make:factory` | `database/factories/<Name>.ts` |
| `make:seeder` | `database/seeds/<Name>.ts` |
| `make:request` | `app/http/requests/<Name>Request.ts` |
| `make:service` | `app/services/<Name>.ts` |
| `make:middleware` | `app/middlewares/<Name>.ts` |
| `make:validator` | `app/validators/<Name>.ts` |
| `make:resource` | `app/http/resources/<Name>.ts` |
| `make:command` | `commands/native/<Name>.ts` |

### Database
| Command | Description |
|---------|-------------|
| `db:migrate` | Run pending migrations |
| `db:rollback` | Rollback last batch |
| `db:seed` | Run seeders |
| `db:fresh` | Drop, migrate, seed |
| `db:status` | Migration status |

### Dev Tools
| Command | Description |
|---------|-------------|
| `generate:types` | Sync types to frontend |
| `doctor` | Health check |
| `lint` | tsc --noEmit (TypeCheck.ts alias) |
| `typecheck` | tsc --noEmit (TypeCheck.ts) |
| `test` | Run tests |
