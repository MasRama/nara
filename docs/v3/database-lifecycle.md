# Nara v3 SQLite lifecycle

Nara v3 uses a local SQLite file through `better-sqlite3` and raw SQL. There is no ORM, query builder, or Nara database abstraction. The connection layer opens the file and configures SQLite; Features own their application schema.

## Layout and ownership

```text
database/
├── dev.sqlite3
├── production.sqlite3
└── backups/

src/shared/database/
├── sqlite.ts       # open/configure/close the shared connection
├── migrator.ts     # discover and apply forward migrations
└── seeder.ts       # discover and run reference seeds

src/features/auth/server/
├── migrations/     # sessions, roles, permissions, RBAC joins
└── seeds/          # permissions, roles, role-permission references

src/features/users/server/
└── migrations/     # users and assets
```

The current baseline migrations create `users`, `sessions`, `roles`, `permissions`, `role_permissions`, `user_roles`, and `assets`. Schema ownership follows the business Feature: `users` owns users/assets and `auth` owns sessions/RBAC. `src/shared/database` owns none of those tables.

SQLite `STRICT` tables were evaluated but are not used for this baseline. Keeping the existing non-STRICT table shape avoids an unnecessary table-reconstruction compatibility break; the previous-v3 compatibility check rejects a `STRICT` schema as non-equivalent, so it requires an explicit corrective migration. A future Feature may adopt `STRICT` for a new table when its data contract warrants it.

`nara new` intentionally creates a minimal health-only application with no database-consuming Feature, so it does not ship dead database scripts or dependencies. An installed or locally created Feature can carry `server/migrations/` and `server/seeds/`; discovery needs no registry or hand-edited manifest. `nara add` copies those source directories with the rest of the Feature.

## Connection settings

Persistent databases are opened after their parent directory is created and use exactly:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

`:memory:` databases skip the persistent WAL/synchronous settings and still enable foreign keys and the busy timeout. Do not put a SQLite database on a shared network filesystem. The database file, its WAL files, and backups must be on storage local to the application host.

## Forward-only migrations

Migration files are plain SQL under a Feature's `server/migrations/` directory. Filenames use a globally sortable numeric identifier and description:

```text
202609030001_create_users.sql
202609030002_create_sessions.sql
202609030003_create_roles.sql
```

The migrator scans `src/features/*/server/migrations/`, sorts by numeric identifier, and rejects duplicate identifiers across Features. No migration manifest is maintained. A migration executes once, forward only; production rollback/down migrations are intentionally not supported. Recover a bad production schema from a backup or create a corrective forward migration.

The internal `_nara_migrations` table stores:

```text
id          TEXT PRIMARY KEY
name        TEXT UNIQUE NOT NULL
checksum    TEXT NOT NULL   -- SHA-256 of the SQL file
applied_at  INTEGER NOT NULL
duration_ms INTEGER NOT NULL
```

Before an applied migration is accepted, its current filename and checksum are compared with the ledger. Editing or renaming an applied migration fails loudly. Restore the immutable file or create a new migration instead.

Each pending migration runs inside `BEGIN IMMEDIATE`. The engine re-checks the ledger after acquiring the write transaction, verifies an existing checksum, executes the SQL, records the ledger row, and commits. Any error rolls back both schema changes and ledger insertion. SQLite's busy timeout handles a second process waiting for the writer; no distributed lock is used.

The former v3 `sqlite.ts` schema bootstrap is recognized only when every expected table, column, index, and foreign key matches the baseline. The migrator then records the baseline files and their current checksums without rewriting data. A partial or different schema is not marked applied and is not destroyed; it requires a deliberate corrective forward migration. V2's old `migrations` history is not silently translated.

## Startup and commands

The normal application startup opens the database and applies pending migrations before Hono begins listening. A migration failure aborts startup. Startup never runs arbitrary seeds.

```bash
npm run migrate          # apply pending migrations
npm run migrate:status   # show applied/pending and verify checksums
npm run migrate:fresh    # development reset, migrate, and reference seeds
npm run seed             # run reference seeds explicitly
npm run bootstrap:admin  # create the first administrator explicitly
npm run db:backup        # create an online SQLite backup
npm run db:check         # run quick_check and foreign_key_check
```

`migrate:fresh` refuses `NODE_ENV=production`, drops the application schema, and rebuilds it through the same migration engine. It does not duplicate `CREATE TABLE` statements. There is no `migrate:rollback` command.

## Seeds and administrator bootstrap

Feature seeds are deterministic, idempotent, and run in transactions. The auth reference seeds restore permissions, `admin`/`user` roles, and their role-permission relationships. Re-running them does not create duplicates.

No administrator account or known password is seeded. `npm run bootstrap:admin` requires non-empty `NARA_ADMIN_EMAIL` and `NARA_ADMIN_PASSWORD` environment variables, validates them using the application registration contract, hashes the password with the real PBKDF2-SHA512 implementation, and assigns the existing `admin` role through `user_roles`. Duplicate email creation is rejected without changes.

## Backup and integrity

`npm run db:backup` uses the `better-sqlite3` online backup API, which snapshots a live WAL database safely into a timestamped, non-overwriting file under `database/backups/`. It does not copy only the main `.sqlite3` file.

`npm run db:check` reports failure and exits non-zero if `PRAGMA quick_check` returns anything other than `ok` or `PRAGMA foreign_key_check` returns rows. A healthy database reports both checks passed.
Both operational commands require an existing persistent database file and fail before opening SQLite when it is absent. They never initialize an empty database; run `npm run migrate` for intentional database creation.

SQLite is the default local-disk architecture, not a multi-host shared database. Applications requiring high write concurrency or a database shared across hosts should use a client/server database architecture instead of stretching SQLite beyond its intended deployment boundary.
