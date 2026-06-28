# ADR 0010: English for user-facing messages

Date: 2025-01-15
Status: Accepted

## Context

Nara is an open-source AI-first starter kit. User-facing messages appear in:
- Toast notifications (frontend)
- Form validation errors (frontend)
- API error responses (JSON `message` field)

The original decision used Indonesian for user-facing messages because the author (MasRama) is Indonesian. After redesigning the UI to an editorial English aesthetic, mixing English UI copy with Indonesian error messages felt inconsistent. English-only is simpler for an open-source starter kit and matches the rest of the codebase.

## Decision

Use English for user-facing messages. English for:
- Code (variables, functions, types)
- Comments (if any)
- Log messages (Logger.info/warn/error)
- Internal error codes (DUPLICATE_EMAIL, FORBIDDEN, etc.)
- Toast notifications
- Form validation errors
- API error responses

Examples:
- `"Email already in use"` (not "Email sudah digunakan")
- `"User created successfully"` (not "User berhasil dibuat")
- `"Failed to create user"` (not "Gagal membuat user")

## Consequences

Positive:
- Consistent language across UI copy and error messages
- Standard for open source, easier for non-Indonesian contributors
- Clear separation — code is English, UI is English

Negative:
- Indonesian users see English messages — acceptable, English is the lingua franca of developer tooling
- Existing Indonesian messages must be migrated

## Alternatives considered

- **Indonesian only** — original decision, inconsistent with English UI copy after redesign.
- **Bilingual (Indonesian + English)** — doubles the work, confusing UX.
- **i18n from start** — overkill for a starter kit, adds complexity.
