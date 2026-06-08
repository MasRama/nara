import SQLite from '@services/SQLite';
import type { Asset } from '@types';

export const createAsset = (data: {
  id: string;
  type: string;
  url: string;
  mime_type?: string | null;
  name?: string | null;
  size?: number | null;
  user_id?: string | null;
}): Asset => {
  const now = new Date();
  SQLite.exec`
    INSERT INTO assets (id, name, type, url, mime_type, size, user_id, created_at, updated_at)
    VALUES (${data.id}, ${data.name ?? null}, ${data.type}, ${data.url}, ${data.mime_type ?? null}, ${data.size ?? null}, ${data.user_id ?? null}, ${now.toISOString()}, ${now.toISOString()})
  `;
  return SQLite.one<Asset>`SELECT * FROM assets WHERE id = ${data.id}`!;
};

export const findAssetsByUserId = (userId: string): Asset[] =>
  SQLite.many<Asset>`SELECT * FROM assets WHERE user_id = ${userId}`;
