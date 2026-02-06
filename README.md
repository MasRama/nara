# Nara

[![npm version](https://img.shields.io/npm/v/@nara-web/core)](https://www.npmjs.com/package/@nara-web/core)
[![npm version](https://img.shields.io/npm/v/create-nara)](https://www.npmjs.com/package/create-nara)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> High-performance TypeScript framework combining HyperExpress, Svelte 5/Vue, and Inertia.js for building modern full-stack applications.

## Quick Start

```bash
npm create nara@latest my-app
cd my-app
npm install
npm run dev
```

The CLI will guide you through selecting:
- Frontend framework (Svelte 5 or Vue 3)
- Optional features (authentication, database, file uploads)

## Features

- **258K+ req/sec** with HyperExpress
- **Built-in security**: CSRF, rate limiting, login throttling
- **Type-safe** routing and validation
- **Svelte 5 / Vue 3** with Inertia.js
- **CLI scaffolding** with `create-nara`
- **SQLite** with BetterSQLite3 (WAL mode)

## Documentation

Visit [nara.dev/docs](https://nara.dev/docs) for complete documentation.

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@nara-web/core](https://www.npmjs.com/package/@nara-web/core) | HTTP framework | ![npm](https://img.shields.io/npm/v/@nara-web/core) |
| [create-nara](https://www.npmjs.com/package/create-nara) | CLI tool | ![npm](https://img.shields.io/npm/v/create-nara) |
| [@nara-web/inertia-svelte](https://www.npmjs.com/package/@nara-web/inertia-svelte) | Svelte adapter | ![npm](https://img.shields.io/npm/v/@nara-web/inertia-svelte) |
| [@nara-web/inertia-vue](https://www.npmjs.com/package/@nara-web/inertia-vue) | Vue adapter | ![npm](https://img.shields.io/npm/v/@nara-web/inertia-vue) |

## CLI Commands

```bash
nara make:controller UserController
nara make:migration create_users
nara db:migrate
nara db:seed
```

Run `node nara help` to see all available commands.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
