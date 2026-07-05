---
authority: canon
description: "Infrastructure services — SQLite wrapper, Authenticate, Logger, Storage, CacheStore, LoginThrottle, View, Migrator, Seeder. Functions, no classes"
tags: [services, sqlite, auth, logger, storage, cache, migration, seed, infrastructure]
---

# Services

> **Authority:** canon — current source of truth for service layer conventions.

Infrastructure code wrapped in functions. No classes, no singletons. Each service is a module of related functions.

## Structure

| File | Purpose | Used by |
|------|---------|---------|
| `SQLite.ts` | better-sqlite3 wrapper (template literals + params + transactions) | queries only |
| `Authenticate.ts` | `hashPassword`, `comparePassword`, `processLogin`, `logout` | handlers, seeds |
| `Logger.ts` | Pino-based structured logging (file rotation via pino-roll) | handlers, middlewares, services |
| `Storage.ts` | Local file storage + `url()` + `filePath()` | assets handler |
| `CacheStore.ts` | In-memory LRU (`assetCache`, `templateCache`) | View, assets |
| `LoginThrottle.ts` | Per-IP + per-email login attempt limiter | auth handler |
| `View.ts` | Inertia HTML shell renderer | renderer middleware |
| `Migrator.ts` | Migration runner (up/down/status/fresh) | scripts/migrate.ts |
| `Seeder.ts` | Seed runner | scripts/seed.ts |
| `index.ts` | barrel exports |

## SQLite Wrapper API

```typescript
SQLite.one<T>`SELECT ... WHERE id = ${id}`      // single row | undefined
SQLite.many<T>`SELECT ... WHERE active = 1`     // array (never undefined)
SQLite.exec`INSERT ...`                          // run (no return)
SQLite.get<T>('SELECT ... WHERE id = ?', [id])  // single row
SQLite.all<T>('SELECT ... WHERE x = ?', [x])    // array
SQLite.run('UPDATE ... WHERE id = ?', [id])     // RunResult
SQLite.update('users', { id }, { name, active: true })  // dynamic update
SQLite.transaction(() => { ... })                // atomic, auto-rollback
SQLite.raw()                                     // native better-sqlite3 (rare)
```

Statement caching built in (`getStmt`). Pragmas: `WAL`, `synchronous=NORMAL`, `foreign_keys=ON`.

## Logger API

```typescript
import Logger from '@services/Logger';
Logger.info('User logged in', { userId });
Logger.warn('Rate limit hit', { ip, endpoint });
Logger.error('Failed to create user', error);
Logger.logAuth('login', { userId });
Logger.logSecurity('csrf_failed', { ip });
```
**Never use `console.log`** in backend (L9, enforced). Bootstrap files (`env.ts`, `App.ts`, `server.ts`) are the only exception — Logger not yet initialized.

## Password Hashing

```typescript
import { hashPassword, comparePassword } from '@services/Authenticate';
const hashed = hashPassword(plaintext);
const valid = comparePassword(plaintext, hashed);
```
**Never use `bcrypt` directly** (L10, enforced). Authenticate wraps bcrypt with the correct cost factor.

## Conventions

- **Layer position** — below handlers, may import `@core`, `@types`, `@config`, `@services` only (L15, enforced)
- **Exception**: `Authenticate.ts` imports session queries (`createSession`, `deleteSession`) — tightly coupled by design
- **No `console.log`** — use `Logger` (L9)
- **No `bcrypt` direct** — wrap in `Authenticate` (L10)
- Functions, not classes — `export const fn = () => ...` or `export function fn()`
- Default export for single-instance wrappers (`SQLite`, `Logger`, `Storage`); named exports for function groups (`hashPassword`, `comparePassword`)

## Anti-Patterns (enforced by lint:layers)

- Importing `@handlers`, `@queries`, `@validators`, `@middlewares` — L15
- `console.log` anywhere — L9
- `from 'bcrypt'` — L10
- Classes — ADR 0002 bans them
