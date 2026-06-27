# Nara

[![CI](https://github.com/MasRama/nara/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRama/nara/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> A quiet foundation for people who build software by talking to machines.

Most starter kits fight the machine. Layers of abstraction it cannot read. Classes it has to guess. Magic it cannot trace. Nara is the opposite — flat, plain, readable. The machine understands it on the first look, and so do you.

---

## The craft of building with machines.

Say to your machine: *"Add a products CRUD."*

That's all. The machine reads `AGENTS.md` for conventions, loads the `crud-pattern` skill for the workflow, checks `SCHEMA.md` for table shapes, writes the types, the migration, the queries, the validator, the handlers, the routes, the page — then runs `npm run check` to verify its own work. You review. You ship.

```
types/models.ts          →  interface Product { ... }
migrations/...ts         →  CREATE TABLE products (...)
queries/products.ts      →  findProductById(), createProduct(), ...
validators/schemas.ts    →  CreateProductSchema (Zod)
handlers/products.ts     →  productsPage, listProducts, addProduct, editProduct, removeProducts
routes/web.ts            →  Route.get/post/put/delete('/products', ...)
Pages/products.svelte    →  Full UI with table, forms, toast notifications
```

Seven files. Correct conventions. The machine did it all — you just asked.

---

## Five quiet principles.

Each one removes a reason for the machine to guess.

**01. Flat, by design.**
Files at arm's reach. No deep nesting to navigate. The machine finds things by name, and so do you.

**02. Functions, not classes.**
Standalone functions the machine writes accurately. No inheritance to hallucinate, no hidden state to chase.

**03. Raw SQL, not magic.**
Every query explicit, readable, predictable. The machine writes SQL fluently. No query builder syntax to invent.

**04. No hidden behavior.**
Traceable end to end. No decorators, no implicit middleware, no magic resolvers.

**05. Few dependencies.**
Fewer APIs to learn. Fewer mistakes to make. Each one earns its place.

See [`docs/decisions/`](./docs/decisions/) for ten ADRs explaining *why* each decision was made.

---

## What makes Nara AI-first.

| Layer | What | Why it matters |
|---|---|---|
| **Context** | `AGENTS.md` (root + 7 nested) + 7 skills + 10 ADRs | The machine reads conventions, not guesses. Skills loaded on demand to save context window. |
| **Topology** | `CODEMAP.md` (111 files indexed, 278 exports) | The machine knows what exists before searching. Reads one file instead of 111. |
| **Scaffolding** | `npm run gen:resource` | Seven files scaffolded with correct conventions. The machine can't make structural mistakes. |
| **Enforcement** | `npm run lint:layers` (17 rules) + 254 tests + pre-commit hook | The machine pushes a violation → blocked. Naming, layer boundaries, import direction, anti-patterns. |
| **Verification** | `npm run check` | One command. The machine doesn't need to remember three. |
| **CI** | 3 steps: typecheck → layer lint → tests | Last line of defense. Cloud agents can't bypass with `--no-verify`. |
| **Policy** | Dependency policy (16 categories: allowed vs banned) | The machine checks the table before suggesting a dependency. No Prisma, no JWT, no React. |
| **Pitfalls** | 10 real mistakes AI makes, with fix | The machine reads before coding. Prevents common errors. |

---

## Begin.

```bash
git clone https://github.com/MasRama/nara.git my-app && cd my-app
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:5555](http://localhost:5555). You're live.

> Migrations run automatically on startup. To reset: `npm run migrate:fresh`

---

## Architecture.

```
Browser (Svelte 5 + Inertia.js)
  │  router.visit() for pages · axios for data
  ▼
Server (ultimate-express / uWebSockets.js)
  │
  ├── Handlers (functions)
  │     ├── Queries (raw SQL via better-sqlite3)
  │     └── Services (Auth, Logger, Storage, CacheStore, LoginThrottle)
  │
  └── SQLite (embedded, zero-config)
```

**Two route types:**

| Type | Called by | Returns |
|------|-----------|---------|
| Page | Browser navigation | `res.inertia('pageName', { data })` |
| Data | `axios` from Svelte | `jsonSuccess()`, `jsonError()`, `jsonCreated()` |

---

## What's inside.

| Area | Stack |
|------|-------|
| Server | ultimate-express (uWebSockets.js, 250k+ req/s) |
| Frontend | Svelte 5, Inertia.js, Tailwind CSS 4, Zag JS |
| Database | SQLite via better-sqlite3, raw SQL migrations |
| Auth | Session-based + Google OAuth + RBAC (roles & permissions) |
| Security | CSRF (double-submit cookie), rate limiting, XSS sanitization, security headers, timing-safe comparisons, login throttling |
| Storage | Local file storage with sharp image processing, magic byte validation |
| DX | Path aliases, structured logging (Pino), Vitest, Docker-ready |

---

## Tooling.

```bash
# Scaffolding (optional — the machine can also write files manually)
npm run gen:resource products -- --fields="name:string,price:number"

# Verification
npm run check              # lint + typecheck + layer lint + tests
npm run lint:layers        # 17 layer boundary + naming + import direction rules

# Topology
npm run codemap            # regenerate CODEMAP.md (111 files, 278 exports)
```

---

## Database.

Migrations are raw SQL strings executed by a lightweight migrator. No ORM, no query builder — just SQL.

```bash
npm run migrate            # run pending migrations (auto-runs on startup)
npm run migrate:rollback   # rollback last batch
npm run migrate:status     # show pending/applied
npm run migrate:fresh      # drop all + re-migrate + seed
npm run seed               # run seeders
```

---

## Deployment.

```bash
# Docker
docker build -t nara-app .
docker run -p 5555:5555 nara-app

# Manual
npm run build && npm start
```

Set `NODE_ENV=production` and configure SSL for production use. See [.env.production.example](./.env.production.example) for reference.

---

## Read.

| File | For | Read when |
|---|---|---|
| [`AGENTS.md`](./AGENTS.md) | Conventions, anti-patterns, structure | First time here |
| [`CODEMAP.md`](./CODEMAP.md) | Codebase topology (111 files, 278 exports) | Before searching the codebase |
| [`routes/web.ts`](./routes/web.ts) | All routes (51 lines) | Before adding routes |
| [`.agents/skills/`](./.agents/skills/SKILL.md) | 7 deep-dive skills (CRUD, SQL, auth, Inertia, API/errors, deps, pitfalls) | When touching that pattern |
| [`docs/decisions/`](./docs/decisions/README.md) | 10 ADRs explaining *why* decisions were made | When questioning a convention |

---

## Requirements.

Node.js >= 20 · npm · That's it. SQLite is embedded.

## License.

[MIT](./LICENSE) — Built by [MasRama](https://github.com/MasRama)
