DROP INDEX IF EXISTS idx_assets_s3_key;

ALTER TABLE assets RENAME COLUMN s3_key TO storage_key;

UPDATE assets
SET storage_key = 'avatars/' || substr(url, length('/api/assets/avatar/') + 1)
WHERE storage_key IS NULL
  AND url LIKE '/api/assets/avatar/%';

CREATE INDEX idx_assets_storage_key ON assets (storage_key);
