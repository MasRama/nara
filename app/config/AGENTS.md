# Config

## Overview

Centralized application constants and environment validation. All magic numbers live here — never hardcode values in controllers or services.

## Structure

| File | Purpose |
|------|---------|
| `constants.ts` | All application constants grouped by domain |
| `env.ts` | Environment variable validation + typed access |
| `index.ts` | Barrel re-export |

## Constants Groups (constants.ts)

| Group | Contents |
|-------|----------|
| `SERVER` | `MAX_BODY_SIZE` (10MB), `DEFAULT_PORT` (5555), `DEFAULT_VITE_PORT` (5173) |
| `AUTH` | `TOKEN_EXPIRY_HOURS`, `SESSION_EXPIRY_MS` (30 days), `MIN_PASSWORD_LENGTH` (8), `BCRYPT_SALT_ROUNDS`, `ERROR_COOKIE_EXPIRY_MS` |
| `PAGINATION` | `DEFAULT_PAGE` (1), `DEFAULT_PAGE_SIZE` (10), `MAX_PAGE_SIZE` (100) |
| `USER` | `MIN_NAME_LENGTH` (2), `MAX_NAME_LENGTH` (100), `MIN_PHONE_LENGTH` (10), `MAX_PHONE_LENGTH` (20) |
| `UPLOAD` | `MAX_FILE_SIZE` (5MB), `ALLOWED_EXTENSIONS`, `UPLOAD_DIR` |
| `CACHE` | Static asset TTL (1 year), API response TTL (5 min), session TTL (1 hour) |
| `RATE_LIMIT` | `MAX_REQUESTS` (100/15min), `LOGIN_MAX_ATTEMPTS` (5), `LOCKOUT_DURATION_MS` (15min), `API_RATE_LIMIT` (60/min), `STRICT_RATE_LIMIT` (10/min) |
| `SECURITY` | `HSTS_MAX_AGE` (1 year), `CSRF_TOKEN_LENGTH` (32), `AUTH_COOKIE_NAME`, `CSRF_COOKIE_NAME` |
| `DATABASE` | Connection defaults, pool limits |
| `LOGGING` | Log levels, defaults, file config |
| `HTTP_STATUS` | All common codes: `OK` (200), `CREATED` (201), `BAD_REQUEST` (400), `UNAUTHORIZED` (401), etc. |
| `ERROR_MESSAGES` | Indonesian localized error strings (auth, validation, not found) |
| `SUCCESS_MESSAGES` | Indonesian localized success strings (created, updated, deleted) |

## Environment Access (env.ts)

```typescript
import { getEnv } from "@config";
// or
import { Env } from "@config";

const env = getEnv();
const port = env.PORT;
const dbFile = env.DB_FILE;
```

`validateEnv()` is called at startup and throws with details if required vars are missing.

## Adding a New Constant

Edit `app/config/constants.ts` and add to the appropriate group:

```typescript
// constants.ts — add to existing group or create a new one
export const PAYMENT = {
  MAX_AMOUNT: 100_000_000,
  CURRENCY: "IDR",
  TIMEOUT_MS: 30_000,
} as const;
```

Then import wherever needed:
```typescript
import { PAYMENT, ERROR_MESSAGES } from "@config";

if (amount > PAYMENT.MAX_AMOUNT) {
  return jsonError(res, ERROR_MESSAGES.PAYMENT.EXCEEDS_LIMIT, 422);
}
```

## Adding a New Env Var

Edit `app/config/env.ts` in two places:

```typescript
// 1. Add to Env interface
export interface Env {
  // ...existing...
  STRIPE_SECRET_KEY?: string;  // optional
  REQUIRED_VAR: string;        // required
}

// 2. Add validation in validateEnv()
export function validateEnv(): Env {
  // ...existing...
  const stripeKey = env.STRIPE_SECRET_KEY || undefined;
  const requiredVar = env.REQUIRED_VAR;
  if (!requiredVar) {
    errors.push('  - REQUIRED_VAR: Required');
  }
  
  return {
    // ...existing...
    STRIPE_SECRET_KEY: stripeKey,
    REQUIRED_VAR: requiredVar!,
  };
}
```

Then access via:
```typescript
import { getEnv } from "@config";
const env = getEnv();
const key = env.STRIPE_SECRET_KEY;
```

## Conventions

- **Always import from `@config`** — never from specific sub-files (`./constants`, `./env`) directly
- **Never hardcode magic numbers** in controllers/services — add to the appropriate constants group
- Error/success messages use **Indonesian language** — keep consistent with `ERROR_MESSAGES` / `SUCCESS_MESSAGES`
- New env vars: update BOTH `Env` interface AND `validateEnv()` — or the variable won't be validated at startup
- Use `HTTP_STATUS.OK` instead of raw `200` — consistency + IDE autocomplete
