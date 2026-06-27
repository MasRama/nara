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
import { updateAvatar, findUserById } from '@queries/users';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD.MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
};

const validateMagicBytes = (buffer: Buffer, mimetype: string): boolean => {
  const expected = IMAGE_MAGIC_BYTES[mimetype];
  if (!expected) return false;
  if (buffer.length < expected.length) return false;
  return expected.every((byte, i) => buffer[i] === byte);
};

export const avatarMiddleware = avatarUpload.single('file');

export const uploadAsset = async (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const userId = req.user.id;

  try {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file) return jsonError(res, 'File avatar wajib diisi', 400, 'FILE_REQUIRED');

    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      Logger.logSecurity('Invalid file magic bytes', { mimetype: file.mimetype, ip: req.ip });
      return jsonError(res, 'File tidak valid', 400, 'INVALID_FILE_TYPE');
    }

    const id = randomUUID();
    const processed = await sharp(file.buffer)
      .webp({ quality: 80 })
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();

    // Validate sharp actually produced valid WebP output
    if (!validateMagicBytes(processed, 'image/webp')) {
      Logger.logSecurity('Sharp produced invalid output', { mimetype: file.mimetype, ip: req.ip });
      return jsonError(res, 'Image processing failed', 400, 'INVALID_OUTPUT');
    }

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

    // Delete previous avatar file from storage (avoid orphaned files)
    const currentUser = findUserById(userId);
    if (currentUser?.avatar) {
      const oldPath = currentUser.avatar.replace(/^\/storage\//, '');
      await Storage.delete(oldPath).catch(() => {});
    }

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

export const serveDistAsset = async (req: NaraRequest, res: NaraResponse) => {
  const file = req.params.file;

  // Path traversal protection
  if (file.includes('..') || file.includes('/') || file.includes('\\') || file.includes('\0')) {
    Logger.logSecurity('Path traversal blocked', { path: file, ip: req.ip });
    return res.status(403).send('Access denied');
  }

  const distDir = path.resolve(process.cwd(), 'dist/assets');
  const filePath = path.resolve(distDir, file);

  // Use path.sep to prevent prefix bypass (e.g. /dist-assets/ matching /dist/)
  if (!filePath.startsWith(distDir + path.sep) && filePath !== distDir) {
    return res.status(403).send('Access denied');
  }

  if (file.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
  else if (file.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
  else res.setHeader('Content-Type', 'application/octet-stream');

  res.setHeader('Cache-Control', 'public, max-age=31536000');

  const cached = assetCache.get(file);
  if (cached) return res.send(cached);

  try {
    if (await fs.promises.access(filePath).then(() => true).catch(() => false)) {
      // Resolve symlinks before serving
      const realPath = fs.realpathSync(filePath);
      const realDistDir = fs.realpathSync(distDir);
      if (!realPath.startsWith(realDistDir + path.sep) && realPath !== realDistDir) {
        Logger.logSecurity('Symlink escape blocked', { path: file, ip: req.ip });
        return res.status(403).send('Access denied');
      }
      const content = await fs.promises.readFile(filePath);
      assetCache.set(file, content);
      return res.send(content);
    }
    return res.status(404).send('Not found');
  } catch {
    return res.status(500).send('Error');
  }
};

export const servePublicAsset = (req: NaraRequest, res: NaraResponse) => {
  const allowed = ['.ico', '.png', '.jpeg', '.jpg', '.gif', '.svg', '.webp',
    '.txt', '.pdf', '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
    '.mp4', '.webm', '.mp3', '.wav'];

  // Decode + normalize to catch double-encoding and unicode bypasses
  let reqPath: string;
  try {
    reqPath = decodeURIComponent(req.path).replace(/^\/+/, '');
    // Second decode to catch double-encoding (%252e -> %2e -> ..)
    reqPath = decodeURIComponent(reqPath);
  } catch {
    Logger.logSecurity('Path decode failed', { path: req.path, ip: req.ip });
    return res.status(403).send('Access denied');
  }

  // Reject path traversal after normalization
  const normalized = path.normalize(reqPath);
  if (normalized.includes('..') || normalized.includes('\0')) {
    Logger.logSecurity('Path traversal blocked', { path: reqPath, ip: req.ip });
    return res.status(403).send('Access denied');
  }

  if (!normalized.includes('.')) return res.status(404).send('Not found');
  if (!allowed.some(ext => normalized.toLowerCase().endsWith(ext))) {
    return res.status(403).send('File type not allowed');
  }

  const publicDir = path.resolve(process.cwd(), 'public');
  const storageDir = path.resolve(process.cwd(), 'storage');
  const resolved = path.resolve(process.cwd(), normalized);

  // Use path.sep to prevent prefix bypass (e.g. /public-evil/ matching /public/)
  const inPublic = resolved === publicDir || resolved.startsWith(publicDir + path.sep);
  const inStorage = resolved === storageDir || resolved.startsWith(storageDir + path.sep);
  if (!inPublic && !inStorage) {
    Logger.logSecurity('Path escape blocked', { path: reqPath, ip: req.ip });
    return res.status(403).send('Access denied');
  }

  if (!fs.existsSync(resolved)) return res.status(404).send('Not found');

  // Resolve symlinks before serving
  try {
    const realPath = fs.realpathSync(resolved);
    const realPublicDir = fs.realpathSync(publicDir);
    const realStorageDir = fs.realpathSync(storageDir);
    const inRealPublic = realPath === realPublicDir || realPath.startsWith(realPublicDir + path.sep);
    const inRealStorage = realPath === realStorageDir || realPath.startsWith(realStorageDir + path.sep);
    if (!inRealPublic && !inRealStorage) {
      Logger.logSecurity('Symlink escape blocked', { path: reqPath, ip: req.ip });
      return res.status(403).send('Access denied');
    }
  } catch {
    return res.status(404).send('Not found');
  }

  return res.download(resolved);
};
