# Nara Framework - AI Assistant Guide

## Project Overview

Nara is a TypeScript web framework inspired by Laravel, designed for building full-stack web applications with a focus on developer experience and type safety.

**Version:** v1.2.11
**Stack:**
- **Backend:** HyperExpress (HTTP server) + Knex (query builder) + Better-SQLite3
- **Frontend:** Svelte 5 + Inertia.js
- **Architecture:** MVC pattern with Event-driven components
- **Features:** RBAC authorization, Form Request validation, Model Factories, API Resources

---

## Directory Structure

```
/Users/masren/docs-project/nara/
├── app/
│   ├── controllers/          # HTTP Controllers (extend BaseController)
│   ├── models/               # Domain models (extend BaseModel<T>)
│   ├── middlewares/          # Express/HyperExpress middlewares
│   ├── validators/           # Validation helper functions
│   ├── events/               # Event definitions and listeners
│   ├── http/                 # API Resources and Form Requests
│   │   ├── resources/        # Response transformers
│   │   └── requests/         # Form Request classes
│   └── core/                 # Framework core exports
├── routes/
│   ├── web.ts                # Web routes (Inertia)
│   └── api.ts                # API routes
├── config/
│   └── constants.ts          # App constants
├── database/
│   ├── migrations/           # Knex migrations
│   ├── seeds/                # Database seeders
│   └── factories/            # Model factories
├── commands/                 # CLI commands
│   └── native/               # Built-in generators
├── resources/
│   └── js/                   # Svelte frontend
│       ├── pages/            # Inertia pages
│       ├── components/       # Svelte components
│       └── layouts/          # Page layouts
├── storage/                  # Logs, uploads, sessions
├── bootstrap.ts              # App initialization
└── cli.ts                    # CLI entry point
```

---

## Path Aliases (ALWAYS USE THESE)

| Alias | Path | Purpose |
|-------|------|---------|
| `@core` | `app/core` | Framework core (BaseController, BaseModel, response helpers) |
| `@models` | `app/models` | Domain models |
| `@services` | `app/services` | DB, Logger, Authenticate service |
| `@middlewares` | `app/middlewares` | Auth, rateLimit, csrf, etc. |
| `@validators` | `app/validators` | Validation helper functions |
| `@config` | `config` | Constants and configuration |
| `@events` | `app/events` | Event system files |
| `@requests` | `app/http/requests` | Form Request classes |
| `@factories` | `database/factories` | Model factories |

---

## Critical Patterns

### 1. Controllers Extend BaseController

All controllers MUST extend `BaseController` to get auto-binding and helper methods.

```typescript
import { BaseController, jsonSuccess, jsonError } from '@core';
import type { Request, Response } from 'hyper-express';
import { User } from '@models';

export class UserController extends BaseController {
  // Auto-bound: no need to bind 'this' in routes

  async index(req: Request, res: Response) {
    const users = await User.all();
    return jsonSuccess(res, users);
  }

  async show(req: Request, res: Response) {
    const user = await User.find(req.params.id);
    if (!user) {
      return jsonError(res, 'User not found', 404);
    }
    return jsonSuccess(res, user);
  }

  async store(req: Request, res: Response) {
    // getBody() helper from BaseController
    const data = await this.getBody(req);
    const user = await User.create(data);
    return jsonCreated(res, user);
  }

  // Protected route helper
  async profile(req: Request, res: Response) {
    // requireAuth() throws if not authenticated
    const user = this.requireAuth(req);
    return jsonSuccess(res, user);
  }

  // Pagination helper
  async list(req: Request, res: Response) {
    const { page, limit } = this.getPaginationParams(req);
    const users = await User.query().paginate(page, limit);
    return jsonPaginated(res, users);
  }
}
```

### 2. Models Extend BaseModel<T>

Models use Knex query builder with built-in CRUD operations.

```typescript
import { BaseModel } from '@core';

export interface IUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  created_at: Date;
  updated_at: Date;
}

export class User extends BaseModel<IUser> {
  protected static tableName = 'users';
  protected static primaryKey = 'id';

  // Hidden fields from JSON serialization
  protected static hidden = ['password'];

  // Custom query scopes
  static active() {
    return this.query().where('is_active', true);
  }

  static byRole(role: string) {
    return this.query().where('role', role);
  }

  // Instance methods
  async posts() {
    return await Post.query().where('user_id', this.data.id);
  }

  isAdmin(): boolean {
    return this.data.role === 'admin';
  }
}
```

### 3. Validation (Plain TypeScript - NOT Zod/Yup)

Use validation helpers from `@validators/validate.ts` - **NEVER** import Zod, Yup, or Joi.

```typescript
import { isEmail, isString, isPhone, isUUID, isBoolean, isArray, isObject } from '@validators';

// In controller
async store(req: Request, res: Response) {
  const body = await this.getBody(req);

  // Validation
  if (!isString(body.name) || body.name.length < 2) {
    return jsonError(res, 'Name is required and must be at least 2 characters', 422);
  }

  if (!isEmail(body.email)) {
    return jsonError(res, 'Valid email is required', 422);
  }

  if (body.phone && !isPhone(body.phone)) {
    return jsonError(res, 'Invalid phone number format', 422);
  }

  // UUID validation
  if (body.category_id && !isUUID(body.category_id)) {
    return jsonError(res, 'Invalid category ID format', 422);
  }

  // Array validation
  if (body.tags && !isArray(body.tags)) {
    return jsonError(res, 'Tags must be an array', 422);
  }

  // Continue with creation...
}
```

Available validators in `/Users/masren/docs-project/nara/app/validators/validate.ts`:
- `isString(value)` - Check if string
- `isEmail(value)` - Email format validation
- `isPhone(value)` - Phone number validation
- `isUUID(value)` - UUID v4 validation
- `isBoolean(value)` - Boolean check
- `isArray(value)` - Array check
- `isObject(value)` - Plain object check
- `isNumber(value)` - Number validation
- `isOptionalString(value)` - Optional string (undefined or string)

### 4. API Resources (app/http/resources/)

Transform models for API responses using Resource classes.

```typescript
import { Resource } from '@core';
import type { User } from '@models';

export class UserResource extends Resource {
  toArray(user: User): Record<string, any> {
    return {
      id: user.data.id,
      name: user.data.name,
      email: user.data.email,
      role: user.data.role,
      created_at: user.data.created_at,
      // Computed fields
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.data.id}`,
    };
  }
}

// Usage in controller
import { UserResource } from '@requests';

async index(req: Request, res: Response) {
  const users = await User.all();
  return jsonSuccess(res, UserResource.collection(users));
}

async show(req: Request, res: Response) {
  const user = await User.find(req.params.id);
  return jsonSuccess(res, new UserResource(user).toArray());
}
```

### 5. Form Requests (app/http/requests/)

Combine authorization and validation in one class.

```typescript
import { FormRequest } from '@core';
import type { Request, Response } from 'hyper-express';
import { isString, isEmail } from '@validators';

export class StoreUserRequest extends FormRequest {
  // Authorization logic
  async authorize(req: Request): Promise<boolean> {
    const user = req.locals?.user;
    return user?.role === 'admin';
  }

  // Validation rules
  async rules(req: Request): Promise<Record<string, any>> {
    const body = await req.json();

    const errors: Record<string, string> = {};

    if (!isString(body.name) || body.name.length < 2) {
      errors.name = 'Name is required and must be at least 2 characters';
    }

    if (!isEmail(body.email)) {
      errors.email = 'Valid email is required';
    }

    return errors;
  }
}

// Usage in controller
async store(req: Request, res: Response) {
  const formRequest = new StoreUserRequest();

  // Check authorization
  if (!(await formRequest.authorize(req))) {
    return jsonError(res, 'Unauthorized', 403);
  }

  // Validate
  const errors = await formRequest.rules(req);
  if (Object.keys(errors).length > 0) {
    return jsonError(res, 'Validation failed', 422, errors);
  }

  const data = await this.getBody(req);
  const user = await User.create(data);
  return jsonCreated(res, user);
}
```

### 6. Factory System (database/factories/)

Generate test data using factories.

```typescript
import { Factory } from '@core';
import { User } from '@models';
import { Authenticate } from '@services';

export class UserFactory extends Factory {
  protected model = User;

  definition(): Record<string, any> {
    return {
      id: crypto.randomUUID(),
      name: this.faker.person.fullName(),
      email: this.faker.internet.email(),
      password: Authenticate.hash('password123'),
      role: 'user',
      is_active: true,
    };
  }

  // State modifiers
  admin(): this {
    return this.state({
      role: 'admin',
    });
  }

  inactive(): this {
    return this.state({
      is_active: false,
    });
  }
}

// Usage
const user = await UserFactory.create();           // Single user
const users = await UserFactory.count(10).create(); // 10 users
const admin = await UserFactory.admin().create();   // Admin user
```

---

## CLI Commands (Use These!)

Nara has a built-in CLI for code generation. Always use these instead of creating files manually.

### Resource Generation
```bash
# Full scaffold (controller + model + migration + factory + seeder)
npx tsx cli.ts make:resource Post
```

### Individual Generators
```bash
# Controller
npx tsx cli.ts make:controller PostController

# Model
npx tsx cli.ts make:model Post

# Form Request
npx tsx cli.ts make:request StorePostRequest

# Factory
npx tsx cli.ts make:factory PostFactory

# Migration
npx tsx cli.ts make:migration create_posts_table

# Seeder
npx tsx cli.ts make:seed PostSeeder

# Middleware
npx tsx cli.ts make:middleware AuthMiddleware
```

### Database Commands
```bash
# Run migrations
npx tsx cli.ts db:migrate

# Rollback last migration
npx tsx cli.ts db:rollback

# Fresh database (drop all + migrate)
npx tsx cli.ts db:fresh

# Seed database
npx tsx cli.ts db:seed

# Fresh + seed
npx tsx cli.ts db:fresh --seed
```

---

## Code Examples

### Complete Controller Example

```typescript
// app/controllers/PostController.ts
import { BaseController, jsonSuccess, jsonError, jsonCreated, jsonPaginated } from '@core';
import type { Request, Response } from 'hyper-express';
import { Post } from '@models';
import { StorePostRequest, PostResource } from '@requests';

export class PostController extends BaseController {
  // GET /posts
  async index(req: Request, res: Response) {
    const { page, limit } = this.getPaginationParams(req);

    const posts = await Post.query()
      .where('published', true)
      .orderBy('created_at', 'desc')
      .paginate(page, limit);

    return jsonPaginated(res, {
      data: PostResource.collection(posts.data),
      meta: posts.pagination,
    });
  }

  // GET /posts/:id
  async show(req: Request, res: Response) {
    const post = await Post.find(req.params.id);

    if (!post) {
      return jsonError(res, 'Post not found', 404);
    }

    return jsonSuccess(res, new PostResource(post).toArray());
  }

  // POST /posts
  async store(req: Request, res: Response) {
    // Authorize
    const user = this.requireAuth(req);

    // Validate
    const formRequest = new StorePostRequest();
    if (!(await formRequest.authorize(req))) {
      return jsonError(res, 'Unauthorized', 403);
    }

    const errors = await formRequest.rules(req);
    if (Object.keys(errors).length > 0) {
      return jsonError(res, 'Validation failed', 422, errors);
    }

    // Create
    const data = await this.getBody(req);
    const post = await Post.create({
      ...data,
      user_id: user.id,
    });

    return jsonCreated(res, new PostResource(post).toArray());
  }

  // DELETE /posts/:id
  async destroy(req: Request, res: Response) {
    const user = this.requireAuth(req);
    const post = await Post.find(req.params.id);

    if (!post) {
      return jsonError(res, 'Post not found', 404);
    }

    // Authorization check
    if (post.data.user_id !== user.id && user.role !== 'admin') {
      return jsonError(res, 'Unauthorized', 403);
    }

    await post.delete();
    return jsonSuccess(res, { message: 'Post deleted' });
  }
}
```

### Route Definition

```typescript
// routes/api.ts
import { Router } from 'hyper-express';
import { PostController } from '@controllers';
import { auth } from '@middlewares';

const router = new Router();
const postController = new PostController();

// Public routes
router.get('/posts', postController.index);
router.get('/posts/:id', postController.show);

// Protected routes
router.post('/posts', auth, postController.store);
router.put('/posts/:id', auth, postController.update);
router.delete('/posts/:id', auth, postController.destroy);

export default router;
```

### Middleware Example

```typescript
// app/middlewares/auth.ts
import type { Request, Response, NextFunction } from 'hyper-express';
import { Authenticate } from '@services';
import { jsonError } from '@core';

export async function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return jsonError(res, 'Authentication required', 401);
  }

  try {
    const user = await Authenticate.verifyToken(token);
    req.locals.user = user;
    return next();
  } catch (error) {
    return jsonError(res, 'Invalid token', 401);
  }
}
```

### Event Listener Example

```typescript
// app/events/UserRegistered.ts
import { Event } from '@core';
import { Logger } from '@services';

export class UserRegistered extends Event {
  constructor(public user: User) {
    super();
  }
}

// Listener
export class SendWelcomeEmail {
  handle(event: UserRegistered) {
    Logger.info(`Sending welcome email to ${event.user.data.email}`);
    // Email sending logic...
  }
}

// Registration
Event.listen(UserRegistered, SendWelcomeEmail);

// Dispatching
event(new UserRegistered(user));
```

---

## Common Pitfalls

### DO NOT:

1. **Don't use Zod, Yup, or Joi for validation**
   - Use the built-in validators from `@validators`
   - They are lightweight and framework-integrated

2. **Don't manually hash passwords**
   ```typescript
   // WRONG
   import bcrypt from 'bcrypt';
   const hash = await bcrypt.hash(password, 10);

   // CORRECT
   import { Authenticate } from '@services';
   const hash = Authenticate.hash(password);
   ```

3. **Don't forget BaseController auto-binding**
   ```typescript
   // WRONG - will lose 'this' context
   router.get('/users', userController.index);

   // CORRECT - BaseController auto-binds methods
   router.get('/users', userController.index);
   // OR if needed: router.get('/users', userController.index.bind(userController));
   ```

4. **Don't use relative imports for core modules**
   ```typescript
   // WRONG
   import { BaseController } from '../../../app/core';

   // CORRECT
   import { BaseController } from '@core';
   ```

5. **Don't forget to extend BaseModel**
   ```typescript
   // WRONG
   export class User {
     // ...
   }

   // CORRECT
   export class User extends BaseModel<IUser> {
     protected static tableName = 'users';
   }
   ```

---

## Database

### Configuration
- **Driver:** Better-SQLite3
- **Query Builder:** Knex.js
- **Mode:** WAL (Write-Ahead Logging) for better concurrency

### Migrations
```typescript
// database/migrations/20240101000001_create_users_table.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.string('email').unique().notNullable();
    table.string('password').notNullable();
    table.enum('role', ['admin', 'user']).defaultTo('user');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
```

### Knex Query Examples
```typescript
// Basic queries
const users = await User.query().where('active', true);
const user = await User.query().where('email', 'test@example.com').first();

// With relationships
const posts = await Post.query()
  .join('users', 'posts.user_id', 'users.id')
  .select('posts.*', 'users.name as author_name');

// Complex queries
const results = await User.query()
  .where('role', 'admin')
  .andWhere('created_at', '>', '2024-01-01')
  .orderBy('created_at', 'desc')
  .limit(10);

// Raw queries (when needed)
const result = await db.raw('SELECT * FROM users WHERE id = ?', [userId]);
```

---

## Response Helpers

All response helpers are available from `@core`:

```typescript
import {
  jsonSuccess,      // 200 OK
  jsonCreated,      // 201 Created
  jsonError,        // Error responses (400, 401, 403, 404, 422, 500)
  jsonPaginated,    // Paginated response wrapper
  jsonNoContent,    // 204 No Content
} from '@core';

// Success response
jsonSuccess(res, data, message?);
// { success: true, data: {...}, message: '...' }

// Created response
jsonCreated(res, data);
// { success: true, data: {...}, message: 'Resource created' }

// Error response
jsonError(res, 'Something went wrong', 500, errors?);
// { success: false, message: '...', errors: {...} }

// Paginated response
jsonPaginated(res, {
  data: [...],
  meta: { currentPage: 1, totalPages: 10, total: 100, perPage: 10 }
});
```

---

## RBAC Authorization

Nara has built-in role-based access control.

```typescript
// Check permissions in controllers
async adminAction(req: Request, res: Response) {
  const user = this.requireAuth(req);

  if (!user.hasRole('admin')) {
    return jsonError(res, 'Admin access required', 403);
  }

  // Or check specific permission
  if (!user.can('users.delete')) {
    return jsonError(res, 'Permission denied', 403);
  }

  // Proceed with admin action...
}

// Middleware approach
import { requireRole } from '@middlewares';

router.delete('/users/:id', auth, requireRole('admin'), userController.destroy);
```

---

## Quick Reference

### Creating a New Feature

1. **Generate resource:**
   ```bash
   npx tsx cli.ts make:resource Product
   ```

2. **Define migration fields**

3. **Run migration:**
   ```bash
   npx tsx cli.ts db:migrate
   ```

4. **Add validation rules** in `app/http/requests/StoreProductRequest.ts`

5. **Define resource transformation** in `app/http/resources/ProductResource.ts`

6. **Implement controller methods**

7. **Add routes** in `routes/api.ts`

8. **Create factory** for testing (optional)

### Testing with Factories

```typescript
// In seeder or test setup
import { UserFactory, PostFactory } from '@factories';

// Create admin user
const admin = await UserFactory.admin().create();

// Create posts for user
const posts = await PostFactory
  .count(5)
  .state({ user_id: admin.id })
  .create();

// Create verified users batch
const users = await UserFactory.verified().count(10).create();
```

---

## File Locations (Reference)

| Component | Location |
|-----------|----------|
| Controllers | `app/controllers/*.ts` |
| Models | `app/models/*.ts` |
| Middlewares | `app/middlewares/*.ts` |
| Validators | `app/validators/*.ts` |
| Resources | `app/http/resources/*.ts` |
| Form Requests | `app/http/requests/*.ts` |
| Factories | `database/factories/*.ts` |
| Migrations | `database/migrations/*.ts` |
| Seeders | `database/seeds/*.ts` |
| Events | `app/events/*.ts` |
| Services | `app/services/*.ts` |
| Routes | `routes/*.ts` |
| Config | `config/*.ts` |
| Frontend Pages | `resources/js/pages/**/*.svelte` |
| Frontend Components | `resources/js/components/**/*.svelte` |

---

## Support

For framework issues or questions:
- Check existing code patterns in the codebase
- Review similar controllers/models for implementation examples
- Use the CLI generators for consistent file structure
