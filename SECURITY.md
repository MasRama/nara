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
- Sessions: server-side, cookie-based (`auth_id`, HttpOnly, SameSite=Lax, Secure in production, 60-day expiry enforced on lookup)
- CSRF: double-submit cookie pattern. The server issues a readable `csrf_token` cookie (SameSite=Lax, Secure in production, HttpOnly never) on API responses; the browser echoes it in the `X-CSRF-Token` header on POST/PUT/PATCH/DELETE under `/api/`. Bootstrap via `GET /api/auth/csrf`. Tokens are cryptographically random and compared in constant time; failures return `403 CSRF_INVALID` without leaking token material.
- Security headers: Hono applies CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and restrictive `Permissions-Policy` on its own responses including errors. `Strict-Transport-Security` (1 year, includeSubDomains) is production-only and never emitted over local HTTP. In development the HTML document is served by Vite (`:5173`) and is not covered by Hono middleware; Hono still covers proxied `/api`, `/health`, and `/ready` responses. Production (`npm run build && npm start`) serves HTML and API from one Node/Hono origin and is authoritative for page headers.
- Rate limits: in-memory per-IP sliding windows (single-host, no Redis). Global API budget (`RATE_LIMIT_MAX`, default 100 req / 15 min; `/health`, `/ready`, and non-API responses are exempt) plus a tighter auth budget (`AUTH_RATE_LIMIT_MAX`, default 10 req / min on login, registration, password change, logout, and avatar upload). Exhaustion returns `429 RATE_LIMITED` with `X-RateLimit-*` and `Retry-After` metadata. Limiter stores sweep expired buckets lazily and enforce a hard 10_000-key ceiling; when the ceiling is still full of active entries, unseen identities fail closed with deterministic `429 RATE_LIMITED` instead of evicting active state, so saturation never hands an attacker a fresh budget.
- Login lockout: 5 failed attempts per normalized email (trimmed, lowercased) or per IP within 15 minutes locks that dimension (`AUTH_LOCKOUT_ATTEMPTS` / `AUTH_LOCKOUT_WINDOW_MS`). Responses never disclose whether the account exists, and a successful login clears the failure state. The throttle store uses the same lazy expiry plus a 10_000-key ceiling that likewise preserves active lockout state and fails closed for untracked identities under cardinality pressure.
- Request bodies: state-changing `/api/` bodies are bounded before parsing by route-owned budgets independent of `Content-Type` (handlers call `req.json()` regardless), capped at 1 MB (`MAX_JSON_BODY_BYTES`) with deterministic `413 PAYLOAD_TOO_LARGE`. Only `POST /api/assets/avatar` owns the narrowly larger upload request budget (5 MB file + 256 KiB framing, ~5.25 MB request cap) with the same `413 PAYLOAD_TOO_LARGE`; the Feature-level 5 MB file check stays authoritative. A body that exists but cannot be inspected fails closed with `413`; bodyless requests are unaffected.
- Client IP and reverse proxy: by default the Node socket address is authoritative and `X-Forwarded-For` is ignored. Behind the documented nginx/Caddy TLS-terminating proxy, set `TRUST_PROXY=true` with `TRUST_PROXY_HOPS` (default 1, max 10) to derive the effective IP from the trusted suffix of `X-Forwarded-For` (rightmost hops). Entries to the untrusted left of the configured trusted suffix cannot select the effective client identity, malformed headers fall back to socket, and trust must only be enabled when the app is not directly reachable. See README deployment notes.
- Input handling: validate-then-normalize at the owning Feature contract (trim names/emails/slugs, normalize email case, reject control bytes, bound lengths; Auth owns role name/slug/description, shared code owns only generic person/email primitives plus the control-byte check). Passwords are length-bounded only and never transformed. Vue's default interpolation escapes rendered text; no stored HTML sanitization is applied. Zod schemas discard unknown keys, which neutralizes prototype-pollution payloads.
- Static files: path-traversal and symlink-escape guards on all served assets
- Passwords: PBKDF2-SHA512 (100k iterations) via `hashPassword()` — never bcrypt directly
