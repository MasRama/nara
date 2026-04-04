# Services Module

## OVERVIEW

Business logic layer providing authentication, database access, logging, file storage, and utility services for the application.

## STRUCTURE

| File | Purpose |
|------|---------|
| `Authenticate.ts` | Password hashing (PBKDF2), session cookies |
| `DB.ts` | Knex query builder instance |
| `Logger.ts` | Pino-based structured logging with rotation |
| `GoogleAuth.ts` | OAuth 2.0 URL parameter generator |
| `Storage.ts` | Local file storage abstraction |
| `LoginThrottle.ts` | In-memory brute force protection |
| `Paginator.ts` | Knex query pagination helper |
| `View.ts` | SPA shell renderer |
| `SQLite.ts` | Native better-sqlite3 wrapper |
| `index.ts` | Barrel exports |

## KEY SERVICES

| Export | Usage |
|--------|-------|
| `DB` | Query builder: `DB('users').where('active', true)` |
| `Logger` | Logging: `Logger.info('msg', { data })` |
| `Authenticate.hash()` | Hash passwords (NOT bcrypt directly) |
| `Authenticate.process()` | Login with session cookie |
| `Authenticate.logout()` | Clear session and redirect |
| `LoginThrottle.isLockedOut()` | Check lockout status |
| `SQLite.get/all/run` | Raw queries with prepared statement cache |
| `Storage.put/get/delete` | File operations |
| `paginate(query, options)` | Paginate Knex queries |
| `view('file', data)` | Render HTML template |

## CONVENTIONS

- **Password hashing**: Always use `Authenticate.hash()` and `Authenticate.compare()` — never use bcrypt directly
- **SQLite vs DB**: Use `SQLite` for raw queries and transactions, use `DB` (Knex) for migrations and complex joins
- **Rate limiting**: Import limits from `@config` (RATE_LIMIT constants)
- **Pagination**: Always use `paginate()` for list endpoints — returns `{ data, meta }`
