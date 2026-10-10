-- Sessions become per-device records the account owner can list and revoke.
-- The cookie token (id) is never exposed; `handle` is the public identifier.
ALTER TABLE sessions ADD COLUMN handle TEXT;
ALTER TABLE sessions ADD COLUMN ip_address TEXT;
ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER;

UPDATE sessions
SET handle = lower(hex(randomblob(16))),
    last_seen_at = created_at
WHERE handle IS NULL;

CREATE UNIQUE INDEX idx_sessions_handle ON sessions (handle);
