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
- Sessions: server-side, cookie-based (`auth_id`, HttpOnly, SameSite=Lax, Secure in production, 60-day expiry enforced on lookup). Each device gets its own session (at most 10 per account; the oldest fall off). Owners list them at `GET /api/auth/sessions` by a random public handle — never the cookie token — and revoke one (`DELETE /api/auth/sessions/:id`) or all others (`POST /api/auth/sessions/revoke-others`). Password changes and admin password resets sign out every other device. `last_seen_at` is written at most every 5 minutes per session.
- Two-factor authentication: optional TOTP (RFC 6238, SHA-1, 30 s, 6 digits, ±1 step drift). Setup, recovery-code regeneration, and disabling re-confirm the current password. When enabled, a correct password issues only a 5-minute single-use challenge (`auth_2fa`, HttpOnly, path-scoped to `/api/auth/two-factor/challenge`); no session exists until a code is verified. Each challenge allows 5 wrong codes before it is discarded, and `/api/auth/two-factor/*` shares the auth rate limit. Accepted time steps are recorded so a code cannot be replayed, and ten single-use recovery codes are stored as SHA-256 hashes. TOTP secrets are stored unencrypted in the database; protect database files and backups accordingly.
- CSRF: double-submit cookie pattern. The server issues a readable `csrf_token` cookie (SameSite=Lax, Secure in production, HttpOnly never) on API responses; the browser echoes it in the `X-CSRF-Token` header on POST/PUT/PATCH/DELETE under `/api/`. Bootstrap via `GET /api/auth/csrf`. Tokens are cryptographically random and compared in constant time; failures return `403 CSRF_INVALID` without leaking token material.
- Security headers: Hono applies CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and restrictive `Permissions-Policy` on its own responses including errors. `Strict-Transport-Security` (1 year, includeSubDomains) is production-only and never emitted over local HTTP. In development Vite serves browser HTML and HMR directly while Hono handles `/api`, `/health`, and `/ready` on the same listener; Hono security middleware therefore covers backend responses, while production (`npm run build && npm start`) remains authoritative for page headers as well.
- Rate limits: in-memory per-IP sliding windows (single-host, no Redis). Global API budget (`RATE_LIMIT_MAX`, default 100 req / 15 min; `/health`, `/ready`, and non-API responses are exempt) plus a tighter auth budget (`AUTH_RATE_LIMIT_MAX`, default 10 req / min on login, registration, password change, logout, two-factor endpoints, and avatar upload — the routes Auth and Users declare `sensitive`). Exhaustion returns `429 RATE_LIMITED` with `X-RateLimit-*` and `Retry-After` metadata. Limiter stores sweep expired buckets lazily and enforce a hard 10_000-key ceiling; when the ceiling is still full of active entries, unseen identities fail closed with deterministic `429 RATE_LIMITED` instead of evicting active state, so saturation never hands an attacker a fresh budget.
- Login lockout: 5 failed attempts per normalized email (trimmed, lowercased) or per IP within 15 minutes locks that dimension (`AUTH_LOCKOUT_ATTEMPTS` / `AUTH_LOCKOUT_WINDOW_MS`). The attempt that trips the lockout and every attempt during it answer `429 LOGIN_LOCKED` with `Retry-After`. Responses never disclose whether the account exists, and a successful login clears the failure state. The throttle store uses the same lazy expiry plus a 10_000-key ceiling that likewise preserves active lockout state and fails closed for untracked identities under cardinality pressure.
- Request bodies: state-changing `/api/` bodies are bounded before parsing by route-owned budgets independent of `Content-Type` (handlers call `req.json()` regardless), capped at 1 MB (`MAX_JSON_BODY_BYTES`) with deterministic `413 PAYLOAD_TOO_LARGE`. Only `POST /api/assets/avatar`, which Users declares with `bodyMaxBytes`, owns the narrowly larger upload request budget (5 MB file + 256 KiB framing, ~5.25 MB request cap) with the same `413 PAYLOAD_TOO_LARGE`; the Feature-level 5 MB file check stays authoritative. A body that exists but cannot be inspected fails closed with `413`; bodyless requests are unaffected.
- Client IP and reverse proxy: by default the Node socket address is authoritative and `X-Forwarded-For` is ignored. Behind the documented nginx/Caddy TLS-terminating proxy, set `TRUST_PROXY=true` with `TRUST_PROXY_HOPS` (default 1, max 10) to derive the effective IP from the trusted suffix of `X-Forwarded-For` (rightmost hops). Entries to the untrusted left of the configured trusted suffix cannot select the effective client identity, malformed headers fall back to socket, and trust must only be enabled when the app is not directly reachable. See [README Database and production](./README.md#database-and-production).
- Live updates: `GET /api/events` (Server-Sent Events) requires a session and is closed by the temporary-password gate like other APIs. Events carry only a topic name, never data; the browser refetches through routes that enforce their own permissions, Session-list changes go only to the account's own devices, and role and Activity topics go only to accounts allowed to read roles or Activity. Ending, revoking, or resetting a session ends its stream at once, and every 25-second heartbeat re-checks the session. Each account keeps at most 10 open streams (the oldest is closed) and the process at most 10_000 (`503 STREAM_CAPACITY` beyond). The hub is in-memory, single process.
- Input handling: validate-then-normalize at the owning Feature contract (trim names/emails/slugs, normalize email case, reject control bytes, bound lengths; Auth owns role name/slug/description, shared code owns only generic person/email primitives plus the control-byte check). Passwords are length-bounded only and never transformed. Vue's default interpolation escapes rendered text; no stored HTML sanitization is applied. Zod schemas discard unknown keys, which neutralizes prototype-pollution payloads.
- Static files: path-traversal and symlink-escape guards on all served assets
- Passwords: PBKDF2-SHA512 (100k iterations) via `hashPassword()` — never bcrypt directly
