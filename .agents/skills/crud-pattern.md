---
authority: canon
owner: masrama
last_verified: 2026-06-28
trigger: Adding a new resource (e.g. products, posts, comments) — full stack from types to UI
---

# CRUD Pattern: Types → Queries → Handlers → Routes → Page

> **Authority:** canon — current source of truth for full-stack resource creation.

## When to use

When adding a new resource to Nara. The pattern is linear and 1:1 — each layer has one file, one responsibility.

## The 5-Layer Stack

```
1. app/types/models.ts        → interface Product { ... }
2. migrations/YYYY...ts       → CREATE TABLE products (...)
3. app/queries/products.ts    → findProductById, createProduct, getProductsPaginated
4. app/handlers/products.ts   → productsPage, index, show, create, update, destroy
5. routes/web.ts              → Route.get/post/put/delete('/products', ...)
6. resources/Pages/products.svelte → table + form + toast
```

## Pattern

### 1. Types

```typescript
// app/types/models.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  user_id: string;
  created_at: number;
  updated_at: number;
}
```

### 2. Migration

```typescript
// migrations/20260301000000_create_products.ts
export const up = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  user_id TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products (user_id);
`;

export const down = `
DROP INDEX IF EXISTS idx_products_user_id;
DROP TABLE IF EXISTS products;
`;
```

### 3. Queries

```typescript
// app/queries/products.ts
import SQLite from '@services/SQLite';
import type { Product } from '@types';

export const findProductById = (id: string): Product | undefined =>
  SQLite.one<Product>`SELECT * FROM products WHERE id = ${id}`;

export const createProduct = (data: { id: string; name: string; price: number; user_id: string }): Product => {
  const now = Date.now();
  SQLite.exec`
    INSERT INTO products (id, name, price, user_id, created_at, updated_at)
    VALUES (${data.id}, ${data.name}, ${data.price}, ${data.user_id}, ${now}, ${now})
  `;
  return findProductById(data.id)!;
};

export const getProductsPaginated = (page: number, limit: number, search = ''): { data: Product[]; total: number } => {
  const offset = (page - 1) * limit;
  const pattern = `%${search}%`;
  const countRow = SQLite.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM products WHERE name LIKE ?', [pattern]
  );
  const data = SQLite.all<Product>(
    'SELECT * FROM products WHERE name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [pattern, limit, offset]
  );
  return { data, total: countRow?.count ?? 0 };
};

export const updateProduct = (id: string, data: Partial<Omit<Product, 'id' | 'created_at'>>): Product | undefined => {
  const { id: _id, created_at: _created_at, ...rest } = data as Record<string, unknown>;
  SQLite.update('products', { id }, rest);
  return findProductById(id);
};

export const deleteProducts = (ids: string[]): void => {
  SQLite.all<Product>('DELETE FROM products WHERE id IN (?)', ids);
};
```

### 4. Handlers

```typescript
// app/handlers/products.ts
import type { NaraRequest, NaraResponse } from '@core';
import { jsonSuccess, jsonCreated, jsonError, jsonServerError, jsonValidationError, jsonPaginated, queryInt, queryString, isUniqueConstraintError } from '@core';
import { randomUUID } from 'crypto';
import Logger from '@services/Logger';
import { findProductById, createProduct, getProductsPaginated, updateProduct, deleteProducts } from '@queries';
import { CreateProductSchema, zodToErrors } from '@validators';

// Page route — renders Inertia page
export const productsPage = (req: NaraRequest, res: NaraResponse) => {
  const page = queryInt(req, 'page');
  const limit = queryInt(req, 'limit', 10);
  const search = queryString(req, 'search');
  const result = getProductsPaginated(page, limit, search);
  return res.inertia('products', {
    products: result.data,
    total: result.total, page, limit,
  });
};

// Data route — returns JSON
export const listProducts = (req: NaraRequest, res: NaraResponse) => {
  const page = queryInt(req, 'page');
  const limit = queryInt(req, 'limit', 10);
  const search = queryString(req, 'search');
  const result = getProductsPaginated(page, limit, search);
  return jsonPaginated(res, 'OK', result.data, {
    total: result.total, page, limit,
    totalPages: Math.ceil(result.total / limit),
    hasNext: page * limit < result.total,
    hasPrev: page > 1,
  });
};

// Mutation — create
export const addProduct = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
  try {
    const product = createProduct({ id: randomUUID(), ...parsed.data, user_id: req.user.id });
    return jsonCreated(res, 'Product created', { product });
  } catch (error: unknown) {
    Logger.error('Failed to create product', error as Error);
    return jsonServerError(res, 'Failed to create product');
  }
};

// Mutation — update
export const editProduct = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
  try {
    const product = updateProduct(req.params.id, parsed.data);
    return jsonSuccess(res, 'Product updated', { product });
  } catch (error: unknown) {
    Logger.error('Failed to update product', error as Error);
    return jsonServerError(res, 'Failed to update product');
  }
};

// Mutation — delete
export const removeProducts = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const ids = req.body.ids as string[];
  deleteProducts(ids);
  return jsonSuccess(res, 'Products deleted');
};
```

### 5. Routes

```typescript
// routes/web.ts
import * as products from '@handlers/products';
import Auth from '@middlewares/auth';

Route.get('/products', [Auth], products.productsPage);
Route.get('/products/data', [Auth], products.listProducts);
Route.post('/products', [Auth], products.addProduct);
Route.put('/products/:id', [Auth], products.editProduct);
Route.delete('/products', [Auth], products.removeProducts);
```

### 6. Page (Svelte 5)

See [`inertia-patterns.md`](./inertia-patterns.md) for full frontend pattern.

## Do / Don't

- **Do** export query functions as `const` arrow functions — never `class`
- **Do** use `SQLite.one`/`SQLite.many`/`SQLite.exec` template literals for static SQL
- **Do** use `SQLite.get`/`SQLite.all`/`SQLite.run` with `?` params for dynamic SQL (IN clauses, variable columns)
- **Do** return `res.inertia()` from page routes, `jsonSuccess()` from data routes
- **Do** add `try/catch` only in handlers (mutation), not in queries
- **Do** use descriptive handler names: `addProduct`, `editProduct`, `removeProducts`, `listProducts` — never generic `index`, `store`, `create`, `update`, `destroy`
- **Don't** import `SQLite` directly from handlers — go through `@queries`
- **Don't** use ORM or query builder — raw SQL only
- **Don't** return `jsonSuccess` from a page route — browser shows raw JSON
- **Don't** return `inertia()` from a data route — use json helpers
- **Don't** modify existing migrations — create a new one
- **Don't** use generic handler names (`index`, `store`, `create`, `update`, `destroy`) — they require context to understand
