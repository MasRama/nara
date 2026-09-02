import { mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import sharp from 'sharp';
import { getCurrentUser, SESSION_COOKIE_NAME } from '../../auth';
import { UPLOAD } from '../../../shared/config';
import { Logger } from '../../../shared/logging';
import { createUserAsset, setUserAvatar } from './assets';

const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

function hasMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const expected = IMAGE_MAGIC_BYTES[mimeType];
  if (!expected || buffer.length < expected.length) return false;
  if (!expected.every((byte, index) => buffer[index] === byte)) return false;
  return mimeType !== 'image/webp' || buffer.subarray(8, 12).toString('ascii') === 'WEBP';
}

function uploadedFile(value: unknown): File | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('arrayBuffer' in value) ||
    typeof value.arrayBuffer !== 'function' ||
    !('size' in value) ||
    typeof value.size !== 'number' ||
    !('type' in value) ||
    typeof value.type !== 'string'
  ) {
    return undefined;
  }
  return value as File;
}

function avatarDirectory(): string {
  return resolve(process.cwd(), 'storage', UPLOAD.AVATAR_DIR);
}

function unauthorized(context: Context): Response {
  return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
}

function invalidFile(context: Context, message: string, code: string, status = 400): Response {
  return context.json({ success: false as const, message, code }, status as 400 | 413);
}

async function removePreviousAvatar(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl) return;
  const filename = basename(new URL(avatarUrl, 'http://nara.local').pathname);
  if (filename !== avatarUrl.split('/').pop() || !filename.endsWith('.webp')) return;
  const target = resolve(avatarDirectory(), filename);
  if (target !== avatarDirectory() && !target.startsWith(`${avatarDirectory()}/`)) return;
  await unlink(target).catch(() => undefined);
}

const uploadAvatarHandler = async (context: Context) => {
  const sessionUser = getCurrentUser(getCookie(context, SESSION_COOKIE_NAME));
  if (!sessionUser) return unauthorized(context);

  let body: Record<string, string | File | (string | File)[]>;
  try {
    body = await context.req.parseBody();
  } catch {
    return invalidFile(context, 'Avatar file is required', 'FILE_REQUIRED');
  }
  const uploaded = body.file;
  const file = uploadedFile(uploaded);
  if (!file) return invalidFile(context, 'Avatar file is required', 'FILE_REQUIRED');
  if (file.size > UPLOAD.MAX_FILE_SIZE) {
    return invalidFile(context, 'File too large (max 5MB)', 'FILE_TOO_LARGE', 413);
  }
  if (!UPLOAD.ALLOWED_MIME_TYPES.some((mimeType) => mimeType === file.type)) {
    Logger.logSecurity('Invalid avatar MIME type', { mimeType: file.type, userId: sessionUser.id });
    return invalidFile(context, 'Invalid file type', 'INVALID_FILE_TYPE');
  }

  try {
    const source = Buffer.from(await file.arrayBuffer());
    if (!hasMagicBytes(source, file.type)) {
      Logger.logSecurity('Invalid avatar magic bytes', { mimeType: file.type, userId: sessionUser.id });
      return invalidFile(context, 'Invalid file', 'INVALID_FILE_TYPE');
    }

    const processed = await sharp(source)
      .webp({ quality: 80 })
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    if (!hasMagicBytes(processed, 'image/webp')) {
      Logger.logSecurity('Image processor produced invalid output', { userId: sessionUser.id });
      return invalidFile(context, 'Image processing failed', 'INVALID_OUTPUT');
    }

    const filename = `${randomUUID()}.webp`;
    const directory = avatarDirectory();
    await mkdir(directory, { recursive: true });
    const target = resolve(directory, filename);
    await writeFile(target, processed, { flag: 'wx' });
    const url = `/api/assets/avatar/${filename}`;
    const asset = createUserAsset({
      name: filename,
      type: 'image',
      url,
      mimeType: 'image/webp',
      size: processed.length,
      userId: sessionUser.id,
    });
    await removePreviousAvatar(sessionUser.avatar);
    setUserAvatar(sessionUser.id, url);
    return context.json({ success: true as const, message: 'Avatar uploaded', data: { asset, url } });
  } catch (error) {
    Logger.error('Avatar upload failed', error instanceof Error ? error : new Error(String(error)));
    return context.json({ success: false as const, message: 'Image processing failed', code: 'UPLOAD_FAILED' }, 400);
  }
};

const serveAvatarHandler = async (context: Context) => {
  const filename = context.req.param('filename');
  if (!filename || basename(filename) !== filename || !/^[a-f0-9-]+\.webp$/i.test(filename)) {
    Logger.logSecurity('Avatar path traversal blocked', { filename: filename ?? '' });
    return context.body('Access denied', 403);
  }
  const directory = avatarDirectory();
  const target = resolve(directory, filename);
  try {
    const resolvedTarget = await realpath(target);
    const resolvedDirectory = await realpath(directory);
    if (!resolvedTarget.startsWith(`${resolvedDirectory}/`)) {
      Logger.logSecurity('Avatar symlink escape blocked', { filename });
      return context.body('Access denied', 403);
    }
    const content = await readFile(resolvedTarget);
    return new Response(content, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': 'image/webp',
      },
    });
  } catch {
    return context.body('Not found', 404);
  }
};

export const assetRoutes = new Hono()
  .post('/avatar', uploadAvatarHandler)
  .get('/avatar/:filename', serveAvatarHandler);
