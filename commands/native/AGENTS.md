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

## Available Commands

### Generators
| Command | Output |
|---------|--------|
| `make:controller` | `app/controllers/<Name>Controller.ts` |
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
| `lint` / `typecheck` | tsc validation |
| `test` | Run tests |
