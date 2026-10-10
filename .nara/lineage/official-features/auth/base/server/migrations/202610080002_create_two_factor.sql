-- TOTP two-factor authentication. A pending secret exists only between setup
-- and confirmation; `two_factor_last_step` rejects replay of an accepted code.
ALTER TABLE users ADD COLUMN two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN two_factor_pending_secret TEXT;
ALTER TABLE users ADD COLUMN two_factor_enabled_at INTEGER;
ALTER TABLE users ADD COLUMN two_factor_last_step INTEGER;

CREATE TABLE two_factor_recovery_codes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_two_factor_recovery_codes_user_id ON two_factor_recovery_codes (user_id);

-- A password-verified sign-in waiting for its second factor. The id is held
-- only in an HttpOnly cookie; attempts are bounded per challenge.
CREATE TABLE two_factor_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_two_factor_challenges_expires_at ON two_factor_challenges (expires_at);
