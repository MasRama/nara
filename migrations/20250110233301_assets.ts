export const up = `
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  s3_key TEXT,
  user_id TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets (user_id);
CREATE INDEX IF NOT EXISTS idx_assets_s3_key ON assets (s3_key);
`;

export const down = `
DROP INDEX IF EXISTS idx_assets_user_id;
DROP INDEX IF EXISTS idx_assets_s3_key;
DROP TABLE IF EXISTS assets;
`;
