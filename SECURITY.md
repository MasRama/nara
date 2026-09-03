# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability in Nara, please report it privately instead of opening a public issue.

**Preferred:** GitHub private vulnerability reporting — go to the repository's **Security** tab and click **Report a vulnerability**.

**Alternative:** email the maintainer directly. Allow up to 7 days for an initial response.

Please include:

- The affected version and endpoint/component
- A minimal reproduction (request payload, steps)
- Impact assessment (what an attacker could do)

## Scope

In scope: the Nara codebase itself — auth, CSRF, rate limiting, input sanitization, asset serving, session handling, and dependency supply chain.

Out of scope: misconfiguration in deployments you control (e.g. missing TLS, open ports), or dependencies with their own published advisories (report those upstream).

## Disclosure

We aim to confirm within 7 days and ship a fix as soon as practical. Please hold public disclosure until a fixed release is published.

## Security model notes

- Same-origin assumption: the Vue app and the Hono API are served from one origin. Session auth relies on it; cross-origin API use is not supported.
- Sessions: server-side, cookie-based (`auth_id`, HttpOnly, SameSite=Lax, Secure in production, 60-day expiry, cleanup on startup and periodically)
- CSRF: double-submit cookie pattern. The server issues a readable `csrf_token` cookie (SameSite=Lax, Secure in production, HttpOnly never) on API responses; the browser echoes it in the `X-CSRF-Token` header on POST/PUT/PATCH/DELETE under `/api/`. Bootstrap via `GET /api/auth/csrf`. Tokens are cryptographically random and compared in constant time; failures return `403 CSRF_INVALID` without leaking token material.
- Security headers: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, restrictive `Permissions-Policy` on every response including errors. `Strict-Transport-Security` (1 year, includeSubDomains) is production-only and never emitted over local HTTP.
- Rate limits: in-memory per-IP sliding windows. Global API budget (`RATE_LIMIT_MAX`, default 100 req / 15 min; `/health`, `/ready`, and non-API responses are exempt) plus a tighter auth budget (`AUTH_RATE_LIMIT_MAX`, default 10 req / min on login, registration, password change, and avatar upload). Exhaustion returns `429 RATE_LIMITED` with `X-RateLimit-*` and `Retry-After` metadata.
- Login lockout: 5 failed attempts per normalized email (trimmed, lowercased) or per IP within 15 minutes locks that dimension (`AUTH_LOCKOUT_ATTEMPTS` / `AUTH_LOCKOUT_WINDOW_MS`). Responses never disclose whether the account exists, and a successful login clears the failure state.
- Request bodies: JSON API payloads are capped at 1 MB (`MAX_JSON_BODY_BYTES`) with deterministic `413 PAYLOAD_TOO_LARGE`. Multipart avatar uploads keep their own 5 MB file policy. Client IPs come from the Node socket address; `X-Forwarded-For` is never trusted.
- Input handling: validate-then-normalize at the owning Feature contract (trim names/emails/slugs, normalize email case, reject control bytes, bound lengths). Passwords are length-bounded only and never transformed. Vue's default interpolation escapes rendered text; no stored HTML sanitization is applied. Zod schemas discard unknown keys, which neutralizes prototype-pollution payloads.
- Static files: path-traversal and symlink-escape guards on all served assets
- Passwords: PBKDF2-SHA512 (100k iterations) via `hashPassword()` — never bcrypt directly
