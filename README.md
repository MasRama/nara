# Nara

[![CI](https://github.com/MasRama/nara/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRama/nara/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)

> Full-stack TypeScript starter kit. Performance-first, batteries-included. Built on **ultimate-express**, **Svelte 5**, and **Inertia.js**.

> **For AI assistants:** See [README-LLM.md](./README-LLM.md) for optimized context file, or [AGENTS.md](./AGENTS.md) for detailed project knowledge base.

## What is Nara?

Nara is an opinionated TypeScript starter kit that curates a high-performance stack and ships with everything you need to build full-stack web applications:

- **Fast server** — ultimate-express (uWebSockets.js) handles 250k+ req/s
- **Modern frontend** — Svelte 5 + Inertia.js (SPA feel without building an API)
- **Zero-config database** — SQLite with Active Record models
- **Auth & RBAC** — session auth, Google OAuth, role-based permissions out of the box
- **Security** — CSRF, rate limiting, input sanitization, security headers
- **CLI scaffolding** — 22 generators for controllers, models, migrations, etc.

Not a framework. Not a library. A **curated starting point** that you clone, customize, and ship.

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
node nara db:migrate
```

### 5. Seed database (optional)

```bash
node nara db:seed
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
│   ├── authorization/    # RBAC Gates & Policies
│   ├── config/          # Configuration & constants
│   ├── controllers/     # HTTP request handlers
│   ├── core/            # App kernel (Router, App, Errors)
│   ├── events/          # Event system & listeners
│   ├── helpers/         # Utility functions
│   ├── middlewares/     # HTTP middlewares
│   ├── models/          # Database models (Active Record)
│   ├── services/        # Business logic services
│   └── validators/      # Input validation schemas
├── commands/            # CLI commands
├── database/            # SQLite database files
├── migrations/          # Database migrations
├── resources/
│   ├── js/             # Svelte components & pages
│   ├── views/          # HTML templates
│   └── css/            # Stylesheets
├── routes/             # Route definitions
├── seeds/              # Database seeders
├── public/             # Static assets
├── storage/            # File uploads
└── logs/               # Application logs
```

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| HTTP Server | ultimate-express (uWebSockets.js) | 250k+ req/s, Express-compatible API |
| Frontend | Svelte 5 + Inertia.js | SPA feel without building an API |
| Database | SQLite (better-sqlite3) | Zero-config, embedded, fast |
| Query Builder | Knex.js | Type-safe, migrations included |
| Bundler | Vite | Fast HMR, modern tooling |
| Testing | Vitest | Jest-compatible, native ESM |

## What's Included

### Authentication & Authorization
- Session-based auth with login throttling
- Google OAuth integration
- Role-based access control (RBAC) with dynamic permissions
- Admin dashboard for managing roles & permissions

### Security (Production-Ready)
- CSRF protection (Double Submit Cookie)
- Rate limiting (sliding window, configurable per endpoint)
- Input sanitization (XSS protection via DOMPurify)
- Security headers (HSTS, CSP, X-Frame-Options)
- Request ID for distributed tracing

### Developer Experience
- 22 CLI generators (`make:controller`, `make:model`, `make:migration`, etc.)
- Type-safe routing with middleware arrays
- Custom validation system (no Zod/Yup/Joi dependency)
- Event system for decoupled side effects
- Active Record models with automatic timestamps
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
- [ ] Run migrations: `node nara db:migrate`
- [ ] Enable rate limiting in `App.ts`
- [ ] Review security headers configuration

## Development

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run TypeScript type check |

### Path Aliases

Import using aliases (configured in `tsconfig.json`):

```typescript
import { BaseController } from '@core';
import { User } from '@models';
import { Logger } from '@services';
import Auth from '@middlewares/auth';
```

## Roadmap

See [TODO.md](./TODO.md) for planned features and improvements.

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
