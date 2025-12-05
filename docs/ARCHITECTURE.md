# Nara Framework Architecture

## Overview

Nara adalah TypeScript web framework yang menggabungkan:
- **HyperExpress** - High-performance HTTP server
- **Svelte 5** - Reactive frontend framework
- **Inertia.js** - SPA-like experience tanpa API

## Directory Structure

```
nara/
├── app/
│   ├── config/           # Configuration & constants
│   │   ├── constants.ts  # All app constants (AUTH, PAGINATION, etc.)
│   │   ├── env.ts        # Environment validation & access
│   │   └── index.ts      # Barrel export
│   │
│   ├── controllers/      # Request handlers
│   │   ├── AuthController.ts
│   │   └── ...
│   │
│   ├── core/             # Framework core
│   │   ├── App.ts        # Application kernel
│   │   ├── BaseController.ts  # Controller base class
│   │   ├── Router.ts     # Type-safe router
│   │   ├── errors.ts     # HTTP error classes
│   │   ├── response.ts   # JSON response helpers
│   │   ├── types.ts      # Core types (NaraRequest, NaraResponse)
│   │   └── index.ts      # Barrel export
│   │
│   ├── middlewares/      # Request middlewares
│   │   ├── auth.ts       # Authentication check
│   │   ├── csrf.ts       # CSRF protection
│   │   ├── rateLimit.ts  # Rate limiting
│   │   └── ...
│   │
│   ├── services/         # Business logic & utilities
│   │   ├── Authenticate.ts  # Auth service
│   │   ├── DB.ts         # Database (Knex)
│   │   ├── Logger.ts     # Logging (Pino)
│   │   ├── Mailer.ts     # Email service
│   │   ├── Paginator.ts  # Pagination helper
│   │   └── index.ts      # Barrel export
│   │
│   └── validators/       # Input validation
│       ├── schemas.ts    # Validation schemas
│       ├── validate.ts   # Validation helpers
│       └── index.ts      # Barrel export
│
├── commands/             # CLI commands
│   ├── native/           # Built-in commands
│   │   ├── MakeController.ts
│   │   ├── MakeResource.ts
│   │   └── ...
│   └── index.ts          # CLI entry point
│
├── database/             # SQLite database files
├── migrations/           # Knex migrations
├── seeds/                # Database seeders
│
├── resources/
│   ├── js/               # Frontend (Svelte)
│   │   ├── Components/   # Reusable components
│   │   ├── Pages/        # Inertia pages
│   │   └── types/        # Frontend types
│   └── views/            # HTML templates
│       └── inertia.html  # SPA shell
│
├── routes/
│   └── web.ts            # Route definitions
│
├── docs/                 # Documentation
├── public/               # Static assets
│
├── server.ts             # Application entry point
├── knexfile.ts           # Knex configuration
├── vite.config.mjs       # Vite configuration
└── tsconfig.json         # TypeScript configuration
```

## Request Flow

```
Request → HyperExpress → Middlewares → Router → Controller → Response
                ↓
         ┌─────────────────────────────────────────────────┐
         │ Middlewares (in order):                         │
         │ 1. CORS                                         │
         │ 2. Security Headers                             │
         │ 3. Request Logger                               │
         │ 4. Rate Limiter                                 │
         │ 5. CSRF Protection                              │
         │ 6. Inertia (for SPA)                           │
         │ 7. Auth (route-specific)                        │
         └─────────────────────────────────────────────────┘
```

## Core Components

### NaraApp (`app/core/App.ts`)

Application kernel yang menangani:
- Server initialization
- Middleware registration
- Route mounting
- Error handling
- Graceful shutdown

```typescript
import { createApp } from "@core";
import routes from "@routes/web";

const app = createApp({ routes });
app.start();
```

### BaseController (`app/core/BaseController.ts`)

Base class untuk semua controller dengan helper methods:

```typescript
class MyController extends BaseController {
  async index(request: NaraRequest, response: NaraResponse) {
    // Auth helpers
    this.requireAuth(request);    // throws AuthError
    this.requireAdmin(request);   // throws ForbiddenError
    
    // Validation
    const data = await this.getBody(request, MySchema);
    
    // Pagination
    const { page, limit, search } = this.getPaginationParams(request);
  }
}
```

### NaraRouter (`app/core/Router.ts`)

Type-safe router wrapper:

```typescript
import { createRouter } from "@core";
import Auth from "@middlewares/auth";

const Route = createRouter();

Route.get("/public", Controller.index);
Route.get("/protected", [Auth], Controller.show);
Route.group("/api", [Auth], (router) => {
  router.get("/users", UserController.index);
});
```

## Path Aliases

Defined in `tsconfig.json`:

| Alias | Path |
|-------|------|
| `@core` | `app/core/index.ts` |
| `@services` | `app/services/index.ts` |
| `@services/*` | `app/services/*` |
| `@validators` | `app/validators/index.ts` |
| `@config` | `app/config/index.ts` |
| `@controllers/*` | `app/controllers/*` |
| `@middlewares/*` | `app/middlewares/*` |

## Error Handling

Custom error classes di `app/core/errors.ts`:

```typescript
throw new AuthError("Invalid credentials");      // 401
throw new ForbiddenError("Admin required");      // 403
throw new NotFoundError("User not found");       // 404
throw new ValidationError("Invalid input", errors); // 422
throw new BadRequestError("Invalid request");    // 400
```

Semua error ditangkap oleh global error handler di `NaraApp`.

## Response Helpers

Di `app/core/response.ts`:

```typescript
jsonSuccess(res, "Message", data);
jsonCreated(res, "Created", data);
jsonPaginated(res, "List", data, meta);
jsonError(res, "Error", 400);
jsonNotFound(res, "Not found");
jsonValidationError(res, "Invalid", errors);
```

## Database

Menggunakan Knex.js dengan SQLite (default):

```typescript
import DB from "@services/DB";

// Query
const user = await DB.from("users").where("id", id).first();

// Insert
await DB.table("users").insert({ id, name, email });

// Update
await DB.from("users").where("id", id).update({ name });

// Delete
await DB.from("users").where("id", id).delete();
```

## Logging

Menggunakan Pino:

```typescript
import Logger from "@services/Logger";

Logger.info("Message", { data });
Logger.error("Error", error);
Logger.logAuth("login_success", { userId });
Logger.logSecurity("Unauthorized", { ip });
```

## CLI Commands

```bash
node nara help                    # Show all commands
node nara make:controller User    # Create controller
node nara make:resource Post      # Create full resource
node nara db:migrate              # Run migrations
node nara db:seed                 # Run seeders
```

## Development

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run linting
npm run typecheck # Type checking
```
