# Nara Security Pack v1

Dokumentasi untuk fitur keamanan yang tersedia di Nara framework.

## Overview

Security Pack v1 mencakup:
1. **Rate Limiting** - Membatasi jumlah request per IP/user
2. **Login Throttling** - Mencegah brute force attack pada login
3. **Security Headers** - Header keamanan standar (HSTS, XFO, CSP, dll)
4. **Request Logging** - Logging semua HTTP request
5. **CSRF Protection** - Perlindungan Cross-Site Request Forgery

---

## 1. Rate Limiting

### File: `app/middlewares/rateLimit.ts`

In-memory rate limiting dengan sliding window algorithm.

### Basic Usage

```typescript
import { rateLimit, strictRateLimit, apiRateLimit } from "@middlewares/rateLimit";

// Default: 100 requests per 15 minutes per IP
app.use(rateLimit());

// Strict: 10 requests per minute (untuk endpoint sensitif)
Route.post('/api/upload', strictRateLimit(), uploadHandler);

// API: 60 requests per minute
Route.use('/api', apiRateLimit());
```

### Custom Configuration

```typescript
Route.use(rateLimit({
  maxRequests: 50,
  windowMs: 60 * 1000, // 1 menit
  keyGenerator: (req) => req.user?.id || req.ip, // Rate limit per user jika login
  skip: (req) => req.path === '/health', // Skip untuk health check
  message: 'Terlalu banyak request, coba lagi nanti',
  headers: true, // Include X-RateLimit-* headers
  name: 'custom', // Nama untuk logging
}));
```

### Response Headers

Ketika rate limiting aktif, response akan include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds until retry (when limited)

### Response (429 Too Many Requests)

```json
{
  "success": false,
  "message": "Terlalu banyak permintaan, coba lagi nanti",
  "retryAfter": 60
}
```

---

## 2. Login Throttling

### File: `app/services/LoginThrottle.ts`

Mencegah brute force attack dengan tracking failed login attempts.

### Features

- Track per email/phone DAN per IP
- Configurable max attempts (default: 5)
- Configurable lockout duration (default: 15 menit)
- Auto-reset setelah lockout berakhir

### Configuration (via constants.ts)

```typescript
export const RATE_LIMIT = {
  MAX_LOGIN_ATTEMPTS: 5,      // Attempts sebelum lockout
  LOGIN_LOCKOUT_MS: 15 * 60 * 1000, // 15 menit lockout
};
```

### Usage in AuthController

```typescript
import LoginThrottle from "@services/LoginThrottle";

// Check lockout sebelum proses login
if (LoginThrottle.isLockedOut(identifier, ip)) {
  const remainingMs = LoginThrottle.getRemainingLockoutTime(identifier, ip);
  return response.status(429).json({
    message: `Coba lagi dalam ${Math.ceil(remainingMs / 60000)} menit`
  });
}

// Record failed attempt
const result = LoginThrottle.recordFailedAttempt(identifier, ip);
// result: { isLocked, remainingAttempts, lockoutMs }

// Clear attempts on successful login
LoginThrottle.clearAttempts(identifier, ip);
```

### API

| Method | Description |
|--------|-------------|
| `isLockedOut(identifier, ip)` | Check if locked out |
| `getRemainingLockoutTime(identifier, ip)` | Get remaining lockout time in ms |
| `recordFailedAttempt(identifier, ip)` | Record failed attempt, returns status |
| `clearAttempts(identifier, ip)` | Clear attempts (on successful login) |
| `getAttemptCounts(identifier, ip)` | Get current attempt counts |
| `getStoreSize()` | Get store size for monitoring |

---

## 3. Security Headers

### File: `app/middlewares/securityHeaders.ts`

Menambahkan security headers ke semua response.

### Default Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer info |
| `X-XSS-Protection` | `0` | Disable legacy XSS filter |
| `Permissions-Policy` | (restricted) | Disable unused browser features |
| `Strict-Transport-Security` | (production only) | Force HTTPS |

### Basic Usage

```typescript
import { securityHeaders, strictSecurityHeaders, devSecurityHeaders } from "@middlewares/securityHeaders";

// Default (recommended)
app.use(securityHeaders());

// Strict (untuk API endpoints)
app.use('/api', strictSecurityHeaders());

// Development (relaxed)
app.use(devSecurityHeaders());
```

### Custom Configuration

```typescript
app.use(securityHeaders({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameOptions: 'SAMEORIGIN', // atau 'DENY' atau false
  contentTypeOptions: 'nosniff',
  referrerPolicy: 'no-referrer',
  csp: {
    enabled: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
    reportOnly: false,
  },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
  },
}));
```

### Content Security Policy (CSP)

CSP adalah **opt-in** karena bisa break aplikasi jika tidak dikonfigurasi dengan benar.

```typescript
// Enable CSP
app.use(securityHeaders({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Untuk Vite/Svelte
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:'], // WebSocket untuk HMR
    },
  },
}));
```

---

## 4. Request Logging

### File: `app/middlewares/requestLogger.ts`

Logging semua HTTP request dengan timing dan metadata.

### Basic Usage

```typescript
import { requestLogger, verboseRequestLogger, errorOnlyRequestLogger } from "@middlewares/requestLogger";

// Default
app.use(requestLogger());

// Verbose (untuk debugging)
app.use(verboseRequestLogger());

// Error only (untuk production dengan traffic tinggi)
app.use(errorOnlyRequestLogger());
```

### Custom Configuration

```typescript
app.use(requestLogger({
  skip: (req) => req.path.startsWith('/health'),
  includeHeaders: ['user-agent', 'referer'],
  includeQuery: true,
  successLevel: 'debug', // Log level untuk 2xx
  clientErrorLevel: 'warn', // Log level untuk 4xx
  serverErrorLevel: 'error', // Log level untuk 5xx
}));
```

### Log Output

```
GET /api/users 200 15ms
POST /api/login 401 8ms
GET /dashboard 200 45ms
```

### Skipped Paths (default)

- `/health`
- `/ready`
- `/favicon.ico`
- `/robots.txt`
- Static assets (`.js`, `.css`, `.png`, dll)

---

## 5. CSRF Protection

### File: `app/middlewares/csrf.ts`

Double Submit Cookie pattern untuk CSRF protection.

### How It Works

1. Server generates random token dan set sebagai cookie
2. Frontend baca cookie dan kirim token di header `X-CSRF-Token`
3. Server validasi bahwa cookie token = header token

### Backend Setup

```typescript
import { csrf, csrfToken, getCSRFToken } from "@middlewares/csrf";

// Apply ke semua routes (recommended)
app.use(csrf());

// Atau hanya untuk routes tertentu
Route.post('/api/transfer', csrf(), transferHandler);

// Generate token tanpa validasi (untuk halaman form)
Route.get('/login', csrfToken(), loginPage);
```

### Frontend Integration

```javascript
// Baca token dari cookie
function getCSRFToken() {
  return document.cookie.match(/csrf_token=([^;]+)/)?.[1];
}

// Include di request
fetch('/api/data', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': getCSRFToken(),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

### Inertia.js Integration

Untuk Inertia.js, token bisa di-pass via shared props:

```typescript
// Di controller
const csrfToken = getCSRFToken(request);
return response.inertia('form', { csrfToken });
```

### Configuration

```typescript
app.use(csrf({
  cookieName: 'csrf_token',
  headerName: 'X-CSRF-Token',
  bodyField: '_csrf', // Alternatif: kirim di body
  tokenLength: 32,
  cookie: {
    path: '/',
    httpOnly: false, // Harus false agar JS bisa baca
    secure: true, // true di production
    sameSite: 'Lax',
    maxAge: 24 * 60 * 60, // 24 jam
  },
  skipIfAuthorization: true, // Skip jika ada Authorization header
}));
```

### Skip CSRF

CSRF otomatis di-skip untuk:
- Safe methods: `GET`, `HEAD`, `OPTIONS`
- Requests dengan `Authorization` header (API auth)
- Custom skip function

---

## App.ts Integration

Security middlewares sudah terintegrasi di `App.ts`:

```typescript
const app = createApp({
  securityHeaders: true,  // Default: true
  requestLogging: true,   // Default: true
  rateLimit: false,       // Default: false (opt-in)
  // ... other options
});
```

### Urutan Middleware

1. Security Headers (pertama, untuk semua response)
2. Request Logging (early, untuk capture semua request)
3. CORS
4. Rate Limiting (sebelum route handlers)
5. Inertia

---

## Constants

Semua security constants ada di `app/config/constants.ts`:

```typescript
export const RATE_LIMIT = {
  MAX_REQUESTS: 100,
  WINDOW_MS: 15 * 60 * 1000,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MS: 15 * 60 * 1000,
  API_MAX_REQUESTS: 60,
  API_WINDOW_MS: 60 * 1000,
  STRICT_MAX_REQUESTS: 10,
  STRICT_WINDOW_MS: 60 * 1000,
};

export const SECURITY = {
  HSTS_MAX_AGE: 365 * 24 * 60 * 60,
  CSRF_TOKEN_LENGTH: 32,
  CSRF_COOKIE_MAX_AGE: 24 * 60 * 60,
  CSRF_COOKIE_NAME: 'csrf_token',
  CSRF_HEADER_NAME: 'X-CSRF-Token',
};
```

---

## Best Practices

1. **Always enable security headers** di production
2. **Enable rate limiting** untuk public APIs
3. **Use login throttling** untuk semua auth endpoints
4. **Enable CSRF** untuk form submissions
5. **Monitor logs** untuk security events
6. **Test thoroughly** sebelum deploy ke production

---

## Future Improvements

- [ ] Redis backend untuk rate limiting (horizontal scaling)
- [ ] 2FA/TOTP support
- [ ] Password policy enforcement
- [ ] Audit trail untuk security events
- [ ] IP blacklist/whitelist
