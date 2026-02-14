# Nara

[![CI](https://github.com/MasRama/nara/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRama/nara/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)

> High-performance TypeScript web framework combining **HyperExpress**, **Svelte 5**, and **Inertia.js** for building modern full-stack applications with exceptional developer experience.

## Philosophy

Nara is designed for developers who want:
- **Type safety** from database to frontend
- **Performance** without compromising developer experience
- **Batteries included** but not bloated
- **Modern stack** with proven technologies

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
│   ├── core/            # Framework core (Router, App, Errors)
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

## Key Features

### Type-Safe Routing

Full TypeScript support from request to response:

```typescript
// routes/web.ts
Route.get('/users', [Auth, AdminOnly], UserController.index);
Route.post('/users', [Auth], UserController.store);

// Type-safe request handlers
class UserController extends BaseController {
  public async store(req: NaraRequest, res: NaraResponse) {
    const data = await this.getBody(req, CreateUserSchema);
    const user = await User.create(data);
    return jsonCreated(res, 'User created', user);
  }
}
```

### Active Record Models

Clean database operations with automatic timestamps:

```typescript
// Find operations
const user = await User.findById(id);
const user = await User.findByEmail(email);

// CRUD operations
const user = await User.create({ name, email, password });
await User.update(id, { name: 'New Name' });
await User.delete(id);

// Query builder
const users = await User.query()
  .where('is_verified', true)
  .orderBy('created_at', 'desc');
```

### Built-in Security

Production-ready security out of the box:

- **CSRF Protection** - Double Submit Cookie pattern
- **Rate Limiting** - Sliding window per IP/user
- **Login Throttling** - Account lockout after failed attempts
- **Input Sanitization** - XSS protection via DOMPurify
- **Security Headers** - HSTS, CSP, X-Frame-Options
- **Request ID** - Distributed tracing for debugging

### Event System

Decoupled architecture with async events:

```typescript
// Dispatch events
await event(new UserRegistered({ user }));

// Register listeners
eventDispatcher.on(UserRegistered, async (event) => {
  await sendWelcomeEmail(event.payload.user);
});
```

### CLI Scaffolding

21+ commands to speed up development:

```bash
# Create resources
node nara make:controller UserController
node nara make:model Post
node nara make:migration create_posts_table
node nara make:validator CreatePost

# Database operations
node nara db:migrate              # Run pending migrations
node nara db:rollback             # Rollback last batch
node nara db:fresh --seed         # Reset & seed database
node nara db:status               # Check migration status

# Development helpers
node nara doctor                  # Check project health
node nara generate:types          # Sync types to frontend
node nara lint                    # TypeScript type check
```

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
