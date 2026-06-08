# Nara

[![CI](https://github.com/MasRama/nara/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRama/nara/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)

> AI-first full-stack TypeScript starter kit. Functions over classes, raw SQL over ORM, minimal abstractions. Built on **ultimate-express**, **Svelte 5**, and **Inertia.js**.

> **For AI assistants:** See [AGENTS.md](./AGENTS.md) for detailed project knowledge base.

## What is Nara?

Nara is an opinionated TypeScript starter kit designed for AI-assisted development:

- **Fast server** — ultimate-express (uWebSockets.js) handles 250k+ req/s
- **Modern frontend** — Svelte 5 + Inertia.js (SPA feel without building an API)
- **Raw SQL database** — SQLite with direct queries, no ORM
- **Auth & RBAC** — session auth, Google OAuth, role-based permissions
- **Security** — CSRF, rate limiting, input sanitization, security headers
- **AI-first** — minimal abstractions so AI can generate code directly

Not a framework. Not a library. A **curated starting point** that you clone, let AI build features, and ship.

## Philosophy

- **No classes** — Functions only
- **No comments** — Code is self-documenting
- **No abstractions** — Inline is fine
- **Raw SQL** — AI writes SQL, we just execute it
- **Minimal code** — Less code = less bugs

## Requirements

- **Node.js** >= 20.0.0 (see `.nvmrc`)
- **SQLite** (built-in, no separate installation needed)
- **npm** or **pnpm**

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/MasRama/nara.git my-app
cd my-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Run migrations

```bash
npm run migrate
```

### 5. Seed database (optional)

```bash
npm run seed
```

### 6. Start development server

```bash
npm run dev
```

The application will be available at:
- **Application**: http://localhost:5555
- **Vite Dev Server**: http://localhost:5173

## Project Structure

```
my-app/
├── app/
│   ├── types/           # TypeScript interfaces
│   ├── queries/         # Raw SQL functions
│   ├── handlers/        # Request handlers (functions)
│   ├── services/        # SQLite, Auth, Logger, Storage
│   ├── middlewares/     # Auth, CSRF, rate limiting
│   ├── events/          # Simple event emitter
│   ├── validators/      # Input validation
│   ├── config/          # Environment & constants
│   └── core/            # App, Router, errors, response helpers
├── routes/              # Route definitions
├── migrations/          # Database migrations (Knex)
├── seeds/               # Database seeders
├── resources/js/        # Svelte 5 frontend
├── server.ts            # Entry point
└── knexfile.ts          # DB config
```

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| HTTP Server | ultimate-express (uWebSockets.js) | 250k+ req/s, Express-compatible API |
| Frontend | Svelte 5 + Inertia.js | SPA feel without building an API |
| Database | SQLite (better-sqlite3) | Zero-config, embedded, fast |
| Bundler | Vite | Fast HMR, modern tooling |
| Testing | Vitest | Jest-compatible, native ESM |

## What's Included

### Authentication & Authorization
- Session-based auth with login throttling
- Google OAuth integration
- Role-based access control (RBAC) with dynamic permissions

### Security (Production-Ready)
- CSRF protection (Double Submit Cookie)
- Rate limiting (sliding window, configurable per endpoint)
- Input sanitization (XSS protection via DOMPurify)
- Security headers (HSTS, CSP, X-Frame-Options)
- Request ID for distributed tracing

### Developer Experience
- Function-based handlers (no class boilerplate)
- Raw SQL queries (AI-friendly, no ORM to learn)
- Type-safe routing with middleware arrays
- Custom validation system (no Zod/Yup/Joi dependency)
- Simple event system (emit/on/off)
- Structured logging (Pino) with rotation

### Frontend
- Svelte 5 with runes (`$state`, `$derived`, `$effect`)
- Inertia.js for server-driven SPA
- Tailwind CSS + shadcn-svelte components
- Toast notifications, API wrapper, CSRF handling
- Dark mode support

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server
NODE_ENV=development
PORT=5555
VITE_PORT=5173
APP_URL=http://localhost:5555
HAS_CERTIFICATE=false

# Database
DB_CONNECTION=development
DB_FILE=database/dev.sqlite3

# Logging
LOG_LEVEL=debug

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5555/google/callback
```

## Deployment

### Using Docker

```bash
# Build image
docker build -t nara-app .

# Run container
docker run -p 5555:5555 -p 5173:5173 nara-app
```

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper `LOG_LEVEL` (info or warn)
- [ ] Set up SSL certificate (`HAS_CERTIFICATE=true`)
- [ ] Run migrations: `npm run migrate`

## Development

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run TypeScript type check |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database |

### Path Aliases

Import using aliases (configured in `tsconfig.json`):

```typescript
import { jsonSuccess } from '@core';
import { findUserById } from '@queries';
import { Logger } from '@services';
import Auth from '@middlewares/auth';
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

Built with ❤️ by [MasRama](https://github.com/MasRama)
