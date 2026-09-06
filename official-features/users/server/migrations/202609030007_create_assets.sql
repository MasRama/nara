CREATE TABLE assets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  s3_key TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_assets_user_id ON assets (user_id);
CREATE INDEX idx_assets_s3_key ON assets (s3_key);
