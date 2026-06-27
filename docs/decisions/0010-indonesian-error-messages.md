# ADR 0010: Indonesian for user-facing error messages

Date: 2025-01-15
Status: Accepted

## Context

Nara is developed by an Indonesian developer (MasRama) and primarily targets Indonesian users. Error messages appear in:
- Toast notifications (frontend)
- Form validation errors (frontend)
- API error responses (JSON `message` field)

Mixing languages (English code + Indonesian messages) is common in Indonesian tech products.

## Decision

Use Indonesian for user-facing error messages. English for:
- Code (variables, functions, types)
- Comments (if any)
- Log messages (Logger.info/warn/error)
- Internal error codes (DUPLICATE_EMAIL, FORBIDDEN, etc.)

Examples:
- `"Email sudah digunakan"` (not "Email already exists")
- `"User berhasil dibuat"` (not "User created successfully")
- `"Gagal membuat user"` (not "Failed to create user")

## Consequences

Positive:
- Consistent user experience — Indonesian users see Indonesian messages
- AI knows the convention — generates Indonesian messages automatically
- Clear separation — code is English, UI is Indonesian

Negative:
- Non-Indonesian developers need translation — acceptable, target audience is Indonesian
- AI must know Indonesian — most models handle this well
- Harder to internationalize later — would need i18n layer (out of scope for starter kit)

## Alternatives considered

- **English only** — standard for open source, but target users are Indonesian.
- **Bilingual (Indonesian + English)** — doubles the work, confusing UX.
- **i18n from start** — overkill for a starter kit, adds complexity.
