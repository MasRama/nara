# Services Module

## Overview

Business logic layer providing authentication, database access, logging, file storage, and utility services.

## Structure

| File | Purpose |
|------|---------|
| `Authenticate.ts` | Password hashing (PBKDF2), session management |
| `DB.ts` | Knex query builder instance with WAL pragma |
| `Logger.ts` | Pino structured logging with daily file rotation |
| `GoogleAuth.ts` | OAuth 2.0 URL parameter generator |
| `Storage.ts` | Local file storage (put/get/delete/url) |
| `LoginThrottle.ts` | In-memory brute force protection |
| `Paginator.ts` | Knex query pagination → `{ data, meta }` |
| `View.ts` | SPA HTML shell renderer |
| `SQLite.ts` | Native better-sqlite3 with prepared statement cache |
| `index.ts` | Barrel exports |

## Authenticate

```typescript
import Authenticate from "@services/Authenticate";

// Hash a password (PBKDF2 — never use bcrypt directly)
const hashed = await Authenticate.hash(plainPassword);

// Verify password
const valid = await Authenticate.compare(plainPassword, storedHash);

// Create session + set cookie (call after successful login)
await Authenticate.process(user, request, response);

// Destroy session + clear cookie + redirect to /login
await Authenticate.logout(request, response);
```

## Logger

```typescript
import Logger from "@services/Logger";

// Basic levels
Logger.info("User logged in", { userId: user.id });
Logger.warn("Rate limit hit", { ip, endpoint });
Logger.error("DB query failed", error);  // error can be Error or Record<string, any>
Logger.debug("Payload received", { body });

// Child logger with persistent context (for request tracing)
const log = Logger.child({ requestId: req.requestId });
log.info("Processing order");   // all logs include requestId automatically

// Specialised helpers
Logger.logAuth("login_success", { userId: user.id, email: user.email });
Logger.logSecurity("csrf_violation", { ip: req.ip });
Logger.logQuery("SELECT * FROM users", 12); // query, durationMs
```

Logs are written to:
- Console (pretty-printed in development)
- `logs/app.log` (daily rotation, 10MB max)
- `logs/error.log` (error+ level only)

## Paginator

```typescript
import { paginate } from "@services/Paginator";
// or: import { paginate } from "@services";

// Always use paginate() for list endpoints — never manual LIMIT/OFFSET
const { page, limit } = this.getPaginationParams(req); // from BaseController

let query = MyModel.query().orderBy("created_at", "desc");

// Apply filters BEFORE calling paginate()
if (search) {
  query = query.where(function () {
    this.where("name", "like", `%${search}%`)
        .orWhere("email", "like", `%${search}%`);
  });
}

const result = await paginate<MyRecord>(query, { page, limit });
// result.data — MyRecord[]
// result.meta — { total, page, limit, totalPages, hasNext, hasPrev }

return jsonPaginated(res, "OK", result.data, result.meta);
```

## Storage

```typescript
import Storage from "@services/Storage";

// Store a Buffer (e.g. file upload)
const file = await Storage.put(buffer, {
  directory: "avatars",       // subfolder within storage/
  name: randomUUID(),         // filename without extension
  extension: "webp",          // extension
});
// file.url  → '/storage/avatars/<uuid>.webp'
// file.path → 'avatars/<uuid>.webp'
// file.size → bytes

// Delete a file
await Storage.delete(file.path);

// Get public URL for a stored path
const url = Storage.url(file.path);
```

## LoginThrottle

```typescript
import LoginThrottle from "@services/LoginThrottle";
import { RATE_LIMIT } from "@config";

// Check if IP/user is locked out before attempting login
if (LoginThrottle.isLockedOut(identifier)) {
  return jsonError(res, ERROR_MESSAGES.AUTH.TOO_MANY_ATTEMPTS, 429);
}

// Record a failed attempt
LoginThrottle.recordFailedAttempt(identifier);

// Clear on successful login
LoginThrottle.clearAttempts(identifier);
```

Config: `RATE_LIMIT.LOGIN_MAX_ATTEMPTS` (5), `RATE_LIMIT.LOCKOUT_DURATION_MS` (15 min)

## DB (Knex)

```typescript
import DB from "@services/DB";

// Raw Knex queries (use sparingly — prefer model methods)
const users = await DB.from("users").where("is_active", true).select("*");
const count = await DB("sessions").where("user_id", id).count("* as count").first();

// Transactions
await DB.transaction(async (trx) => {
  await trx("users").update({ role: "admin" }).where("id", userId);
  await trx("audit_logs").insert({ ... });
});
```

Knex is configured with SQLite WAL mode for better concurrent reads.

## SQLite (raw)

```typescript
import SQLite from "@services/SQLite";

// Use for performance-critical raw queries with prepared statement caching
const user = SQLite.get<UserRecord>("SELECT * FROM users WHERE id = ?", [id]);
const users = SQLite.all<UserRecord>("SELECT * FROM users WHERE active = 1");
SQLite.run("DELETE FROM sessions WHERE expires_at < ?", [Date.now()]);
```

Use `DB` (Knex) for migrations and complex joins; use `SQLite` for high-frequency raw queries.

## Conventions

- **Password hashing**: Always `Authenticate.hash()` / `Authenticate.compare()` — NEVER bcrypt directly
- **Pagination**: Always `paginate(query, { page, limit })` — NEVER manual LIMIT/OFFSET
- **Logging errors**: `Logger.error("msg", error)` — pass the `Error` object, not `.message` string
- **Rate limiting**: Import thresholds from `@config` RATE_LIMIT — never hardcode numbers
- **File uploads**: Use `Storage.put(buffer, opts)` — never write to disk manually
- **DB vs SQLite**: DB (Knex) for complex queries/joins/migrations; SQLite for hot-path raw queries
