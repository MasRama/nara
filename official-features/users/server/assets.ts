import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../shared/database';
import type { UserAsset } from '../contract';

export function createUserAsset(data: {
  id?: string;
  name: string;
  type: string;
  url: string;
  mimeType: string;
  size: number;
  storageKey: string;
  userId: string;
}): UserAsset {
  const id = data.id ?? randomUUID();
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO assets (id, name, type, url, mime_type, size, storage_key, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, data.name, data.type, data.url, data.mimeType, data.size, data.storageKey, data.userId, now, now);
  return getDatabase().prepare('SELECT * FROM assets WHERE id = ?').get(id) as UserAsset;
}

export function findUserAssets(userId: string): UserAsset[] {
  return getDatabase()
    .prepare('SELECT * FROM assets WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as UserAsset[];
}

/** Every account that still owns at least one asset. */
export function findAssetOwnerIds(): string[] {
  return (getDatabase().prepare('SELECT DISTINCT user_id FROM assets WHERE user_id IS NOT NULL').all() as Array<{ user_id: string }>).map(
    (row) => row.user_id,
  );
}

export function findUserAssetByUrl(url: string): UserAsset | undefined {
  return getDatabase().prepare('SELECT * FROM assets WHERE url = ?').get(url) as UserAsset | undefined;
}

export function deleteUserAsset(assetId: string): boolean {
  return getDatabase().prepare('DELETE FROM assets WHERE id = ?').run(assetId).changes > 0;
}
