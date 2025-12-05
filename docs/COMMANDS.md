# CLI Commands Reference

## Overview

Nara CLI menyediakan berbagai command untuk development dan maintenance.

```bash
node nara <command> [arguments] [options]
```

---

## Scaffolding Commands

### make:controller

Membuat controller baru.

```bash
node nara make:controller <name>
```

**Example:**
```bash
node nara make:controller User
# Creates: app/controllers/UserController.ts
```

**Generated file extends BaseController dengan:**
- `index()` - List with pagination
- `store()` - Create new record
- `show()` - Get single record
- `update()` - Update record
- `destroy()` - Delete record

---

### make:resource

Membuat resource lengkap (controller, validator, routes, optional pages).

```bash
node nara make:resource <name> [options]
```

**Options:**
- `--api` - Generate API-only controller (no Inertia)
- `--with-pages` - Generate Svelte pages

**Example:**
```bash
node nara make:resource Post
# Creates:
#   - app/controllers/PostController.ts
#   - app/validators/post.ts

node nara make:resource Post --with-pages
# Also creates:
#   - resources/js/Pages/Post/Index.svelte
#   - resources/js/Pages/Post/Create.svelte
#   - resources/js/Pages/Post/Edit.svelte
#   - resources/js/Pages/Post/Show.svelte
```

---

### make:middleware

Membuat middleware baru.

```bash
node nara make:middleware <name>
```

**Example:**
```bash
node nara make:middleware RateLimit
# Creates: app/middlewares/rateLimit.ts
```

---

### make:validator

Membuat validator schema baru.

```bash
node nara make:validator <name>
```

**Example:**
```bash
node nara make:validator Post
# Creates: app/validators/post.ts
```

---

### make:service

Membuat service baru.

```bash
node nara make:service <name>
```

**Example:**
```bash
node nara make:service Payment
# Creates: app/services/Payment.ts
```

---

### make:command

Membuat CLI command baru.

```bash
node nara make:command <name>
```

**Example:**
```bash
node nara make:command SendNewsletter
# Creates: commands/native/SendNewsletter.ts
```

---

### make:migration

Membuat database migration baru.

```bash
node nara make:migration <name>
```

**Example:**
```bash
node nara make:migration create_posts_table
# Creates: migrations/YYYYMMDDHHMMSS_create_posts_table.ts
```

---

### make:seeder

Membuat database seeder baru.

```bash
node nara make:seeder <name>
```

**Example:**
```bash
node nara make:seeder users
# Creates: seeds/users.ts
```

---

## Database Commands

### db:migrate

Menjalankan semua pending migrations.

```bash
node nara db:migrate [options]
```

**Options:**
- `--env=<environment>` - Specify environment (development/production)

**Example:**
```bash
node nara db:migrate
node nara db:migrate --env=production
```

---

### db:rollback

Rollback migration batch terakhir.

```bash
node nara db:rollback [options]
```

**Options:**
- `--env=<environment>` - Specify environment

**Example:**
```bash
node nara db:rollback
```

---

### db:fresh

Drop semua tables dan jalankan ulang semua migrations.

```bash
node nara db:fresh [options]
```

**Options:**
- `--env=<environment>` - Specify environment
- `--seed` - Run seeders after migration

**Example:**
```bash
node nara db:fresh
node nara db:fresh --seed
```

---

### db:seed

Menjalankan database seeders.

```bash
node nara db:seed [options]
```

**Options:**
- `--env=<environment>` - Specify environment

**Example:**
```bash
node nara db:seed
```

---

### db:status

Menampilkan status migrations.

```bash
node nara db:status
```

---

## Development Commands

### doctor

Check project health dan konfigurasi.

```bash
node nara doctor
```

Checks:
- Environment variables
- Database connection
- Required files
- Dependencies

---

### lint

Menjalankan ESLint.

```bash
node nara lint
```

---

### typecheck

Menjalankan TypeScript type checking.

```bash
node nara typecheck
```

---

### test

Menjalankan tests.

```bash
node nara test
```

---

## Backup Commands

### backup

Membuat backup database.

```bash
node nara backup [options]
```

**Options:**
- `--compress` - Compress backup file

---

### restore

Restore database dari backup.

```bash
node nara restore <backup-file>
```

---

### clean-backup

Membersihkan backup files lama.

```bash
node nara clean-backup [options]
```

**Options:**
- `--days=<n>` - Delete backups older than n days

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `make:controller <name>` | Create controller |
| `make:resource <name>` | Create full resource |
| `make:middleware <name>` | Create middleware |
| `make:validator <name>` | Create validator |
| `make:service <name>` | Create service |
| `make:command <name>` | Create CLI command |
| `make:migration <name>` | Create migration |
| `make:seeder <name>` | Create seeder |
| `db:migrate` | Run migrations |
| `db:rollback` | Rollback migrations |
| `db:fresh` | Fresh database |
| `db:seed` | Run seeders |
| `db:status` | Migration status |
| `doctor` | Check project health |
| `lint` | Run linting |
| `typecheck` | Type checking |
| `test` | Run tests |
| `backup` | Backup database |
| `restore` | Restore database |
| `clean-backup` | Clean old backups |

---

## Creating Custom Commands

1. Create command file:
```bash
node nara make:command MyCommand
```

2. Edit `commands/native/MyCommand.ts`:
```typescript
import { printSuccess, printError, printInfo, colors } from "../index";

class MyCommand {
  public args: string[] = [];
  public commandName = "my:command";
  public description = "My custom command";

  public async run() {
    const arg = this.args[1]; // First argument after command name
    
    printInfo("Starting...");
    
    // Your logic here
    
    printSuccess("Done!");
  }
}

export default new MyCommand();
```

3. Run command:
```bash
node nara my:command [arguments]
```
