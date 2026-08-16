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

- Sessions: server-side, cookie-based (60-day expiry, cleanup on startup and periodically)
- CSRF: double-submit cookie pattern, `X-CSRF-Token` header, constant-time comparison
- Rate limits: in-memory per-IP (`strictRateLimit`, 10 req/min) + login throttling (per-IP and per-email lockout)
- Input sanitization: strips HTML tags from request body/query (basic XSS defense) — password fields are never mutated
- Static files: path-traversal and symlink-escape guards on all served assets
- Passwords: PBKDF2-SHA512 (100k iterations) via `hashPassword()` — never bcrypt directly
