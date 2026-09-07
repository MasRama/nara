import { mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import sharp from 'sharp';
import { createUserAsset, deleteUserAsset, findUserAssetByUrl, findUserAssets } from './assets';
import type { UsersServerHost } from './host';

/**
 * Users-owned avatar upload policy. These limits mirror the upload
 * contract the Feature validates and reports; they live here (not in
 * shared config) because the Users Feature must install without
 * reference-only shared modules.
 */
const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_DIR = 'avatars';
const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

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
  return resolve(process.cwd(), 'storage', AVATAR_DIR);
}

function unauthorized(context: Context): Response {
  return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
}

function invalidFile(context: Context, message: string, code: string, status = 400): Response {
  return context.json({ success: false as const, message, code }, status as 400 | 413);
}

function avatarFileTarget(avatarUrl: string | null | undefined): string | undefined {
  if (!avatarUrl) return undefined;
  const pathname = new URL(avatarUrl, 'http://nara.local').pathname;
  if (!pathname.startsWith('/api/assets/avatar/')) return undefined;
  const filename = basename(pathname);
  if (filename !== pathname.split('/').pop() || !/^[a-f0-9-]+\.webp$/i.test(filename)) return undefined;
  const directory = avatarDirectory();
  const target = resolve(directory, filename);
  return target !== directory && target.startsWith(`${directory}/`) ? target : undefined;
}

async function removeAvatarFile(avatarUrl: string | null | undefined): Promise<boolean> {
  const target = avatarFileTarget(avatarUrl);
  if (!target) return true;
  try {
    await unlink(target);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}

async function cleanupPreviousUserAvatar(userId: string, previousAvatarUrl: string | null | undefined): Promise<void> {
  if (avatarFileTarget(previousAvatarUrl) === undefined) return;
  const previous = findUserAssets(userId).find((asset) => asset.url === previousAvatarUrl);
  if (!previous) {
    await removeAvatarFile(previousAvatarUrl);
    return;
  }
  try {
    deleteUserAsset(previous.id);
  } catch {
    // Keep cleanup best-effort after the new avatar has committed.
    return;
  }
  await removeAvatarFile(previous.url);
}

/** Remove every persisted local avatar for accounts that have been deleted. */
export async function cleanupUserAvatarAssets(userIds: string[]): Promise<void> {
  for (const userId of [...new Set(userIds)]) {
    for (const asset of findUserAssets(userId)) {
      if (avatarFileTarget(asset.url) === undefined) continue;
      try {
        deleteUserAsset(asset.id);
      } catch {
        continue;
      }
      // Once the row is gone, the HTTP serving path refuses this URL even if
      // filesystem cleanup fails. The physical unlink remains best-effort.
      await removeAvatarFile(asset.url);
    }
  }
}

const uploadAvatarHandlerFor = (host: UsersServerHost) => async (context: Context) => {
  const sessionUser = host.resolveActor(getCookie(context, host.sessionCookieName));
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
  if (file.size > AVATAR_MAX_FILE_SIZE) {
    return invalidFile(context, 'File too large (max 5MB)', 'FILE_TOO_LARGE', 413);
  }
  if (!AVATAR_ALLOWED_MIME_TYPES.some((mimeType) => mimeType === file.type)) {
    return invalidFile(context, 'Invalid file type', 'INVALID_FILE_TYPE');
  }

  try {
    const source = Buffer.from(await file.arrayBuffer());
    if (!hasMagicBytes(source, file.type)) {
      return invalidFile(context, 'Invalid file', 'INVALID_FILE_TYPE');
    }

    const processed = await sharp(source)
      .webp({ quality: 80 })
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    if (!hasMagicBytes(processed, 'image/webp')) {
      return invalidFile(context, 'Image processing failed', 'INVALID_OUTPUT');
    }

    const filename = `${randomUUID()}.webp`;
    const directory = avatarDirectory();
    await mkdir(directory, { recursive: true });
    const target = resolve(directory, filename);
    await writeFile(target, processed, { flag: 'wx' });
    const url = `/api/assets/avatar/${filename}`;
    let asset: ReturnType<typeof createUserAsset> | undefined;
    try {
      asset = createUserAsset({
        name: filename,
        type: 'image',
        url,
        mimeType: 'image/webp',
        size: processed.length,
        userId: sessionUser.id,
      });
      const updated = host.updateAccount(sessionUser.id, { avatar: url });
      if (!updated) throw new Error('Account disappeared during avatar update');
    } catch (error) {
      if (asset) {
        try { deleteUserAsset(asset.id); } catch { /* compensation is best-effort */ }
      }
      await unlink(target).catch(() => undefined);
      throw error;
    }

    // Delete only the avatar this request replaced. Deleting every sibling
    // asset here is unsafe under concurrent uploads: another request may have
    // created its file before committing it as the account avatar.
    await cleanupPreviousUserAvatar(sessionUser.id, sessionUser.avatar);
    return context.json({ success: true as const, message: 'Avatar uploaded', data: { asset, url } });
  } catch (error) {
    return context.json({ success: false as const, message: 'Image processing failed', code: 'UPLOAD_FAILED' }, 400);
  }
};

const serveAvatarHandler = async (context: Context) => {
  const filename = context.req.param('filename');
  if (!filename || basename(filename) !== filename || !/^[a-f0-9-]+\.webp$/i.test(filename)) {
    return context.body('Access denied', 403);
  }
  const directory = avatarDirectory();
  const target = resolve(directory, filename);
  try {
    const url = `/api/assets/avatar/${filename}`;
    if (!findUserAssetByUrl(url)) return context.body('Not found', 404);
    const resolvedTarget = await realpath(target);
    const resolvedDirectory = await realpath(directory);
    if (!resolvedTarget.startsWith(`${resolvedDirectory}/`)) {
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

/**
 * Avatar HTTP behavior constructed from the same host requirements as the
 * user routes. The application binding builds both groups from one host
 * value; this module never imports another Feature. The account avatar URL
 * is written through the identity host because account rows are
 * provider-owned; only the `assets` rows are written here.
 */
export function createAssetRoutes(host: UsersServerHost) {
  return new Hono().post('/avatar', uploadAvatarHandlerFor(host)).get('/avatar/:filename', serveAvatarHandler);
}
