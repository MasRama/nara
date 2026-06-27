# ADR 0005: Session-based auth over JWT

Date: 2025-01-15
Status: Accepted

## Context

Authentication for a web app can be:
- **Session-based** — server stores session, cookie identifies user
- **JWT** — stateless token, no server storage, signed claims

For a starter kit with server-rendered pages (Inertia), session auth is simpler and more secure.

## Decision

Use session-based authentication:
- Sessions stored in `sessions` table (SQLite)
- Session ID in HTTP-only cookie (`auth_id`)
- `Auth` middleware loads user + roles + permissions onto `req.user`
- Session expiry configurable in `app/config/constants.ts`
- Google OAuth supported as alternative login method

## Consequences

Positive:
- Server can revoke sessions instantly (delete from `sessions`)
- No token leakage risk (JWT in localStorage is vulnerable to XSS)
- No token refresh complexity
- Works with Inertia (cookies sent automatically with requests)
- CSRF protection via double-submit cookie (already implemented)

Negative:
- Requires server storage (one row per session) — acceptable for SQLite
- Not stateless (can't validate without database) — acceptable for a server-rendered app
- Doesn't work for mobile apps (need API tokens) — out of scope for starter kit

## Alternatives considered

- **JWT** — stateless, no server storage, but: can't revoke, vulnerable to XSS if in localStorage, refresh token complexity, overkill for server-rendered app.
- **OAuth-only** — no password login, but: requires Google account, not suitable for all users, adds external dependency.
