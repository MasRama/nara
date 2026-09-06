-- The assets owner reference is provider-neutral: user_id names the owning
-- account without a database foreign key into Auth-owned identity storage.
-- Asset rows are addressed by URL, so deleting an account no longer clears
-- the reference automatically (previously ON DELETE SET NULL).
CREATE TABLE assets_next (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  s3_key TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO assets_next (id, name, type, url, mime_type, size, s3_key, user_id, created_at, updated_at)
  SELECT id, name, type, url, mime_type, size, s3_key, user_id, created_at, updated_at FROM assets;

DROP TABLE assets;

ALTER TABLE assets_next RENAME TO assets;

CREATE INDEX idx_assets_user_id ON assets (user_id);
CREATE INDEX idx_assets_s3_key ON assets (s3_key);
