# Middlewares

## Overview

HTTP request/response middleware for authentication, security, rate limiting, and request processing.

## Structure

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for all middlewares |
| `auth.ts` | Session-based authentication guard |
| `csrf.ts` | Double Submit Cookie CSRF protection |
| `rateLimit.ts` | Sliding window rate limiter |
| `securityHeaders.ts` | HSTS, CSP, X-Frame-Options headers |
| `requestId.ts` | Distributed tracing ID |
| `inertia.ts` | Inertia.js response handler |
| `authorize.ts` | RBAC authorization guard |
| `inputSanitize.ts` | XSS input sanitization |
| `requestLogger.ts` | Request/response logging |

## Key Exports

```typescript
// Authentication
import { Auth } from "@middlewares";

// Rate limiting (multiple presets)
import { rateLimit, strictRateLimit, apiRateLimit } from "@middlewares";

// CSRF protection
import { csrf, csrfToken, getCSRFToken } from "@middlewares";

// Security headers
import { securityHeaders, strictSecurityHeaders, devSecurityHeaders } from "@middlewares";

// Request tracking
import { requestId, requestIdWithOptions } from "@middlewares";

// Inertia.js
import { default as inertia } from "@middlewares/inertia";
```

## Conventions

All middlewares follow the NaraMiddleware signature:

```typescript
type NaraMiddleware = (req: NaraRequest, res: NaraResponse, next: () => void) => void;
```

Middleware functions are factory functions that accept options and return the middleware:

```typescript
// Without options
app.use(requestId());

// With options
app.use(rateLimit({ maxRequests: 100, windowMs: 60000 }));
app.use(csrf({ cookieName: 'csrf_token', headerName: 'X-CSRF-Token' }));
app.use(requestIdWithOptions({ headerName: 'x-trace-id', trustUpstream: false }));
```

Apply middleware via Route or app:

```typescript
// Route-level
Route.get('/admin', [Auth, AdminOnly], DashboardController.index);

// Global
app.use(securityHeaders());
```