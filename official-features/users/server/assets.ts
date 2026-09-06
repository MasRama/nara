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
  userId: string;
}): UserAsset {
  const id = data.id ?? randomUUID();
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO assets (id, name, type, url, mime_type, size, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, data.name, data.type, data.url, data.mimeType, data.size, data.userId, now, now);
  return getDatabase().prepare('SELECT * FROM assets WHERE id = ?').get(id) as UserAsset;
}

export function findUserAssets(userId: string): UserAsset[] {
  return getDatabase()
    .prepare('SELECT * FROM assets WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as UserAsset[];
}

export function setUserAvatar(userId: string, avatarUrl: string): void {
  getDatabase().prepare('UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?').run(avatarUrl, Date.now(), userId);
}
