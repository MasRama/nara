import type { NaraRequest, NaraResponse } from '@core';
import { jsonError, jsonServerError, jsonSuccess } from '@core';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import multer from 'multer';
import Logger from '@services/Logger';
import { Storage } from '@services';
import { assetCache } from '@services/CacheStore';
import { UPLOAD } from '@config/constants';
import { createAsset } from '@queries/assets';
import { updateAvatar } from '@queries/users';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('INVALID_FILE_TYPE'));
  },
});

export const avatarMiddleware = avatarUpload.single('file');

export const uploadAsset = async (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const userId = req.user.id;

  try {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file) return jsonError(res, 'File avatar wajib diisi', 400, 'FILE_REQUIRED');

    const id = randomUUID();
    const processed = await sharp(file.buffer)
      .webp({ quality: 80 })
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

    const stored = await Storage.put(processed, {
      directory: UPLOAD.AVATAR_DIR,
      name: id,
      extension: 'webp',
    });

    createAsset({
      id, type: 'image', url: stored.url,
      mime_type: 'image/webp', name: `${id}.webp`,
      size: processed.length, user_id: userId,
    });

    updateAvatar(userId, stored.url);

    return jsonSuccess(res, 'Avatar berhasil diupload', { url: stored.url });
  } catch (error) {
    const err = error as Error;
    if (err.message === 'INVALID_FILE_TYPE') {
      return jsonError(res, 'Invalid file type', 400, 'INVALID_FILE_TYPE');
    }
    if (err.message === 'LIMIT_FILE_SIZE' || (err as any).code === 'LIMIT_FILE_SIZE') {
      return jsonError(res, 'File too large (max 5MB)', 413, 'FILE_TOO_LARGE');
    }
    Logger.error('Upload error', err);
    return jsonServerError(res, 'Internal server error');
  }
};

export const distFolder = async (req: NaraRequest, res: NaraResponse) => {
  const file = req.params.file;
  const filePath = `dist/assets/${file}`;

  if (file.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
  else if (file.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
  else res.setHeader('Content-Type', 'application/octet-stream');

  res.setHeader('Cache-Control', 'public, max-age=31536000');

  const cached = assetCache.get(file);
  if (cached) return res.send(cached);

  try {
    if (await fs.promises.access(filePath).then(() => true).catch(() => false)) {
      const content = await fs.promises.readFile(filePath);
      assetCache.set(file, content);
      return res.send(content);
    }
    return res.status(404).send('Not found');
  } catch {
    return res.status(500).send('Error');
  }
};

export const publicFolder = (req: NaraRequest, res: NaraResponse) => {
  const allowed = ['.ico', '.png', '.jpeg', '.jpg', '.gif', '.svg', '.webp',
    '.txt', '.pdf', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
    '.mp4', '.webm', '.mp3', '.wav'];

  const reqPath = decodeURIComponent(req.path).replace(/^\/+/, '');

  if (reqPath.includes('..') || reqPath.includes('%2e') || reqPath.includes('\0')) {
    Logger.logSecurity('Path traversal blocked', { path: reqPath, ip: req.ip });
    return res.status(403).send('Access denied');
  }

  if (!reqPath.includes('.')) return res.status(404).send('Not found');
  if (!allowed.some(ext => reqPath.toLowerCase().endsWith(ext))) {
    return res.status(403).send('File type not allowed');
  }

  const publicDir = path.resolve(process.cwd(), 'public');
  const storageDir = path.resolve(process.cwd(), 'storage');
  const resolved = path.resolve(process.cwd(), reqPath);

  if (!resolved.startsWith(publicDir) && !resolved.startsWith(storageDir)) {
    Logger.logSecurity('Path escape blocked', { path: reqPath, ip: req.ip });
    return res.status(403).send('Access denied');
  }

  if (!fs.existsSync(resolved)) return res.status(404).send('Not found');
  return res.download(resolved);
};
