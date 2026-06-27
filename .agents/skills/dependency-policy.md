---
authority: canon
last_verified: 2026-06-28
trigger: Adding a dependency, or before suggesting a library/package
---

# Dependency Policy

> **Authority:** canon — current source of truth for dependency decisions.

AI must not add dependencies without checking this table. If a category is "Banned", suggest the allowed alternative instead.

| Category | Allowed | Banned | Why |
|---|---|---|---|
| Database | `better-sqlite3` | Prisma, Drizzle, Knex, Sequelize, TypeORM | ADR 0001 — raw SQL, AI writes SQL fluently |
| Framework | `ultimate-express` | Express, Fastify, Koa, Hono | Nara uses uWebSockets.js for performance |
| Frontend | `svelte`, `@inertiajs/svelte` | React, Vue, Solid, Angular | ADR 0003 — Inertia + Svelte 5 |
| UI primitives | `@zag-js/*` | Headless UI, Radix, Melt | ADR 0007 — framework-agnostic state machines |
| Validation | `zod` | Joi, Yup, class-validator, valibot | ADR 0006 — TypeScript-first, type inference |
| Auth | `@services/Authenticate` (internal) | bcrypt (direct), passport, jsonwebtoken | ADR 0005 — session-based, internal wrapper |
| HTTP client | `axios` | fetch (in frontend), got, node-fetch | `api()` wrapper handles CSRF + toast |
| Logging | `pino` (via `@services/Logger`) | winston, morgan, console.log | Structured logging, file rotation built-in |
| Styling | `tailwindcss`, `clsx`, `tailwind-merge`, `tailwind-variants` | styled-components, emotion, CSS modules | Utility-first, AI generates Tailwind fluently |
| Icons | `@lucide/svelte` | heroicons, feather-icons, font-awesome | Tree-shakeable, consistent API |
| Image processing | `sharp` | jimp, canvas, gm | Native binding, fast |
| File upload | `multer` | formidable, busboy | Memory storage + sharp pipeline |
| State (frontend) | Svelte 5 runes (`$state`, `$derived`, `$effect`) | Redux, Zustand, Pinia, Svelte stores | ADR 0003 — server is source of truth |
| Testing | `vitest` | jest, mocha, jasmine | Vite-native, fast, ESM support |
| Date/time | native `Date`, `Intl` | moment, dayjs, date-fns | Standard library sufficient |
| Utils | native `crypto`, `path`, `fs` | lodash, underscore, ramda | Standard library sufficient |

## Adding a new dependency

1. Check if the category is in the table above
2. Check if the need can be met with the allowed dependency or standard library
3. If a new dependency is truly needed, add it to `package.json`, update this table, and add an ADR explaining why
