# Archived: nara-dependencies

> **Archived 2026-09-07 — historical reference only.** This was an active
> contributor skill under `.agents/skills/nara-dependencies/` until the agent
> guidance simplification (six active skills). Its static Allowed/Banned
> table is intentionally not retained anywhere else: dependency truth is
> source-derived from `package.json`, with architectural restrictions coming
> from `AGENTS.md`, `ARCHITECTURE.md`, and ADRs. Kept here for history; do
> not use as implementation instructions.

---
name: nara-dependencies
description: Adding a dependency, or before suggesting a library or package
---

# Dependency Policy

Do not add dependencies without checking this table. If a category is banned, use the allowed v3 option or standard library instead.

| Category | Allowed | Banned | Why |
|---|---|---|---|
| Database | `better-sqlite3` | Prisma, Drizzle, Knex, Sequelize, TypeORM | ADR 0001 — raw SQL keeps intent explicit |
| HTTP framework | `hono`, `@hono/node-server` | Express, Ultimate Express, Fastify, NestJS, `uWebSockets.js` | ARCHITECTURE.md — portable Node HTTP stack |
| Frontend framework | `vue`, `vue-router` | React, Svelte, Solid, Angular, Nuxt, `@inertiajs/*` | ARCHITECTURE.md — Vue 3 is the sole supported framework |
| Frontend build/typecheck | `vite`, `@vitejs/plugin-vue`, `vue-tsc` | framework-specific SSR tooling | Direct Vue + Vite + TypeScript |
| UI primitives | Native Vue elements and existing Tailwind/CSS | Svelte-only component libraries, custom Nara UI framework | Keep browser composition direct and framework-transparent |
| HTTP client | Feature-scoped Hono typed clients, native `fetch` where required | axios, got, node-fetch, global RPC wrappers | Keep contracts feature-owned and transport visible |
| Validation | `zod` | Joi, Yup, class-validator, valibot | TypeScript-first inference (ADR 0006) |
| Auth | `src/features/auth` session interface | bcrypt direct, passport, jsonwebtoken | Session auth remains feature-owned (ADR 0005) |
| Logging | `pino` through `src/shared/logging` | winston, morgan, `console.log` | Structured logging and redaction |
| Styling | `tailwindcss`, `@tailwindcss/vite`, plain CSS | styled-components, emotion, CSS-in-JS frameworks | Existing utility-first styling |
| Icons | Text or existing browser-safe assets | Svelte-only icon packages | No default icon dependency |
| Image processing | `sharp` | jimp, canvas, gm | Existing bounded image pipeline |
| State (frontend) | Vue Composition API (`ref`, `computed`, `watch`) | Redux, Zustand, Pinia, Svelte runes, global stores | Keep state local unless a task proves a shared store is needed |
| Testing | `vitest`, `jsdom` | jest, mocha, jasmine | Existing Vite-native test stack |
| Date/time | native `Date`, `Intl` | moment, dayjs, date-fns | Standard library is sufficient |
| Utils | native `crypto`, `path`, `fs` | lodash, underscore, ramda | Standard library is sufficient |

## Adding a new dependency

1. Check whether the need can be met by the existing stack or the standard library.
2. Check the locked-stack rules in `AGENTS.md` and `ARCHITECTURE.md`.
3. If a new dependency is truly required, add it to `package.json` and add an ADR only when it represents a material architectural decision.
4. Never add a second frontend framework, SSR stack, or framework-agnostic Nara abstraction.
