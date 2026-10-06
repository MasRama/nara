# Nara SQLite lifecycle

Nara uses a local SQLite file through `better-sqlite3` and raw SQL. There is no ORM, query builder, or Nara database abstraction. The connection layer opens the file and configures SQLite; Features own their application schema.

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
├── migrations/     # users, sessions, roles, permissions, RBAC joins
└── seeds/          # permissions, roles, role-permission references

src/features/users/server/
└── migrations/     # assets (with a provider-neutral owner reference)
```

One Feature owns each table; no table has two writers from different
Features:

- `auth` owns account identity data: `users` (identity, credentials,
  login identifiers, avatar), `sessions`, `roles`, `permissions`,
  `role_permissions`, and `user_roles`. Its account directory
  (`findAccountById`, `listAccounts`, `createAccount`, `updateAccount`,
  `deleteAccounts`) is the only writer of account rows.
- `users` owns the `assets` table (avatar/profile asset metadata). The
  `assets.user_id` column is an opaque owner reference with no foreign
  key into Auth-owned storage, so the Users package installs and runs
  without depending on one provider's account table. Deleting an account
  does not rewrite asset rows; assets are addressed by URL.

Capabilities that need account behavior but do not own it (such as user
management) reach accounts exclusively through a typed host requirement
adapted in application-owned bindings — never through direct SQL on
another Feature's tables.

The current baseline migrations create `users`, `sessions`, `roles`,
`permissions`, `role_permissions`, `user_roles`, and `assets`, plus the
forward migration that drops the original `assets.user_id` foreign key.
Schema ownership follows the business Feature above.
`src/shared/database` owns none of those tables.

SQLite `STRICT` tables were evaluated but are not used for this baseline. Keeping the existing non-STRICT table shape avoids an unnecessary table-reconstruction compatibility break; the previous-v3 compatibility check rejects a `STRICT` schema as non-equivalent, so it requires an explicit corrective migration. A future Feature may adopt `STRICT` for a new table when its data contract warrants it.

The reference application ships the guaranteed application substrate (`src/shared/database/` engine, `src/shared/config/` environment, and `src/shared/storage/` asset-storage capability). The database engine and storage contract are platform; application tables remain Feature-owned. Startup applies pending migrations before serving traffic.

## Connection settings

Persistent databases are opened after their parent directory is created and use exactly:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA optimize=0x10002;
```

`:memory:` databases skip the persistent WAL/synchronous settings and still enable foreign keys and the busy timeout. Do not put a SQLite database on a shared network filesystem. The database file, its WAL files, and backups must be on storage local to the application host.

`PRAGMA optimize=0x10002` runs when the shared connection opens so SQLite can
refresh planner statistics when appropriate without forcing a full `ANALYZE`.
After a migration actually applies schema changes Nara also runs
`PRAGMA optimize`. The reference app repeats the normal `PRAGMA optimize`
periodically as low-cost maintenance. This is deliberately separate from
`VACUUM`: Nara never performs an automatic database rebuild or compaction.

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
npm run setup            # migrate, seed, and create the first admin if needed
npm run bootstrap:admin  # first-admin bootstrap only (also ensures migrate + seed)
npm run db:backup        # create an online SQLite backup
npm run db:check         # run quick_check and foreign_key_check
```

`migrate:fresh` refuses `NODE_ENV=production`, drops the application schema, and rebuilds it through the same migration engine. It does not duplicate `CREATE TABLE` statements. There is no `migrate:rollback` command.

## Seeds and administrator bootstrap

Feature seeds are deterministic, idempotent, and run in transactions. The auth reference seeds restore permissions, `admin`/`user` roles, and their role-permission relationships. Re-running them does not create duplicates.

Administrator credentials remain separate from reference seeds. `npm run setup`
and `npm run bootstrap:admin` create an administrator only when no administrator
already exists. Without overrides the reference application uses the convenient
development bootstrap `Admin` / `admin@nara.local` / `admin12345`, stores only
its PBKDF2-SHA512 hash, marks the credential temporary, and forces a password
change before normal authenticated access. `NARA_ADMIN_NAME`,
`NARA_ADMIN_EMAIL`, and `NARA_ADMIN_PASSWORD` override the bootstrap values; an
explicit password is treated as intentional and is not marked temporary.
Existing administrator credentials are never reset by setup/bootstrap, and a
non-admin collision on the requested bootstrap email is rejected without
changes. Managed password resets are also temporary: sessions are revoked and
the target must choose a new password after the next login.

## Backup and integrity

`npm run db:backup` uses the `better-sqlite3` online backup API, which snapshots a live WAL database safely into a timestamped, non-overwriting file under `database/backups/`. It does not copy only the main `.sqlite3` file.

`npm run db:check` reports failure and exits non-zero if `PRAGMA quick_check` returns anything other than `ok` or `PRAGMA foreign_key_check` returns rows. A healthy database reports both checks passed.
Both operational commands require an existing persistent database file and fail before opening SQLite when it is absent. They never initialize an empty database; run `npm run migrate` for intentional database creation.

## Runtime maintenance and retention

The reference application starts one maintenance timer in addition to the
hourly expired-session cleanup. The maintenance timer runs every 24 hours and
is stopped with the rest of the application runtime during graceful shutdown.

Each maintenance pass performs two bounded operations:

1. `PRAGMA optimize` lets SQLite update planner statistics only when SQLite
   determines that doing so is useful.
2. Activity events older than `ACTIVITY_RETENTION_DAYS` are deleted oldest
   first, with at most 10,000 rows removed per pass. The same bounded prune
   runs once at application startup so stale history starts converging without
   waiting a full day.

The default retention is 365 days. Set `ACTIVITY_RETENTION_DAYS=0` to disable
automatic Activity pruning. Values above zero are interpreted as whole days
and validated at startup. Retention is application policy: deployments with a
legal or audit requirement for a longer history should increase the value or
disable pruning and manage archival/storage explicitly.

Deleting old rows makes their pages reusable inside SQLite but does not promise
that the database file shrinks on disk. Nara intentionally does not run
`VACUUM` automatically because it is a heavier rebuild-style maintenance
operation. Likewise WAL checkpointing remains SQLite-managed during normal
runtime; the application does not force periodic `TRUNCATE` checkpoints.

SQLite is the default local-disk architecture, not a multi-host shared database. Applications requiring high write concurrency or a database shared across hosts should use a client/server database architecture instead of stretching SQLite beyond its intended deployment boundary.
