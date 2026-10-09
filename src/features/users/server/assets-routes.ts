import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import sharp from 'sharp';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
  AVATAR_MAX_FILE_SIZE_MB,
  type AvatarUploadSuccess,
} from '../contract';
import { createUserAsset, deleteUserAsset, findUserAssetByUrl, findUserAssets } from './assets';
import { createGuard, type Guard, type RoutePolicy } from '../../../shared/security';
import type { UsersServerHost } from './host';
import { announceAccountsChanged } from './live';

const AVATAR_STORAGE_PREFIX = 'avatars';

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

function invalidFile(context: Context, message: string, code: string, status = 400) {
  return context.json({ success: false as const, message, code }, status as 400 | 413);
}

function validAvatarFilename(filename: string): boolean {
  return /^[a-f0-9-]+\.webp$/i.test(filename);
}

function legacyAvatarStorageKey(url: string): string | undefined {
  const pathname = new URL(url, 'http://nara.local').pathname;
  if (!pathname.startsWith('/api/assets/avatar/')) return undefined;
  const filename = pathname.slice('/api/assets/avatar/'.length);
  return validAvatarFilename(filename) ? `${AVATAR_STORAGE_PREFIX}/${filename}` : undefined;
}

export function assetStorageKey(asset: { storage_key: string | null; url: string }): string | undefined {
  return asset.storage_key ?? legacyAvatarStorageKey(asset.url);
}

async function cleanupPreviousUserAvatar(
  host: UsersServerHost,
  userId: string,
  previousAvatarUrl: string | null | undefined,
): Promise<void> {
  if (!previousAvatarUrl) return;
  const previous = findUserAssets(userId).find((asset) => asset.url === previousAvatarUrl);
  if (!previous) return;
  const storageKey = assetStorageKey(previous);
  try {
    deleteUserAsset(previous.id);
  } catch {
    // Keep cleanup best-effort after the new avatar has committed.
    return;
  }
  if (storageKey) await host.assetStorage.delete(storageKey).catch(() => false);
}

/** Remove persisted avatar objects after their owning accounts are deleted. */
export async function cleanupUserAvatarAssets(host: UsersServerHost, userIds: string[]): Promise<void> {
  for (const userId of [...new Set(userIds)]) {
    for (const asset of findUserAssets(userId)) {
      const storageKey = assetStorageKey(asset);
      try {
        deleteUserAsset(asset.id);
      } catch {
        continue;
      }
      // Once metadata is gone, the HTTP serving path refuses this URL even if
      // provider cleanup fails. Binary deletion remains best-effort.
      if (storageKey) await host.assetStorage.delete(storageKey).catch(() => false);
    }
  }
}

const uploadAvatarHandlerFor = (host: UsersServerHost, guard: Guard<NonNullable<ReturnType<UsersServerHost['resolveActor']>>>) => async (context: Context) => {
  const sessionUser = guard.actor(context);

  let body: Record<string, string | File | (string | File)[]>;
  try {
    body = await context.req.parseBody();
  } catch {
    return invalidFile(context, 'Avatar file is required', 'FILE_REQUIRED');
  }
  const uploaded = body.file;
  const file = uploadedFile(uploaded);
  if (!file) return invalidFile(context, 'Avatar file is required', 'FILE_REQUIRED');
  if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
    return invalidFile(context, `File too large (max ${AVATAR_MAX_FILE_SIZE_MB}MB)`, 'FILE_TOO_LARGE', 413);
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
    const storageKey = `${AVATAR_STORAGE_PREFIX}/${filename}`;
    await host.assetStorage.put({ key: storageKey, data: processed, contentType: 'image/webp' });
    const url = `/api/assets/avatar/${filename}`;
    let asset: ReturnType<typeof createUserAsset> | undefined;
    try {
      asset = createUserAsset({
        name: filename,
        type: 'image',
        url,
        mimeType: 'image/webp',
        size: processed.length,
        storageKey,
        userId: sessionUser.id,
      });
      // A new photo is not a form edit: it applies whatever the revision, and raises it.
      const updated = host.updateAccount(sessionUser.id, { avatar: url });
      if (updated.status === 'missing') throw new Error('Account disappeared during avatar update');
    } catch (error) {
      if (asset) {
        try { deleteUserAsset(asset.id); } catch { /* compensation is best-effort */ }
      }
      await host.assetStorage.delete(storageKey).catch(() => false);
      throw error;
    }

    // Delete only the avatar this request replaced. Deleting every sibling
    // asset here is unsafe under concurrent uploads: another request may have
    // created its file before committing it as the account avatar.
    await cleanupPreviousUserAvatar(host, sessionUser.id, sessionUser.avatar);
    announceAccountsChanged(host, [sessionUser.id]);
    return context.json({ success: true as const, message: 'Avatar uploaded', data: { asset, url } } satisfies AvatarUploadSuccess);
  } catch (error) {
    return context.json({ success: false as const, message: 'Image processing failed', code: 'UPLOAD_FAILED' }, 400);
  }
};

const serveAvatarHandlerFor = (host: UsersServerHost) => async (context: Context) => {
  const filename = context.req.param('filename');
  if (!filename || !validAvatarFilename(filename)) {
    return context.body('Access denied', 403);
  }
  try {
    const url = `/api/assets/avatar/${filename}`;
    const asset = findUserAssetByUrl(url);
    if (!asset) return context.body('Not found', 404);
    const storageKey = assetStorageKey(asset);
    if (!storageKey) return context.body('Not found', 404);
    const stored = await host.assetStorage.get(storageKey);
    if (!stored) return context.body('Not found', 404);
    return new Response(Buffer.from(stored.data), {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': asset.mime_type ?? 'application/octet-stream',
      },
    });
  } catch {
    return context.body('Not found', 404);
  }
};

/**
 * Mounted next to `createAssetRoutes`. The upload counts toward the strict
 * per-client limit, and its request budget is the file limit plus a 256 KiB
 * multipart framing allowance; the file check in the handler stays
 * authoritative.
 */
export const USERS_ASSET_ROUTE_POLICIES = [
  { method: 'POST', path: '/avatar', sensitive: true, bodyMaxBytes: AVATAR_MAX_FILE_SIZE_BYTES + 256 * 1024 },
] as const satisfies readonly RoutePolicy[];

/**
 * Avatar HTTP behavior constructed from the same host requirements as the
 * user routes. The application binding builds both groups from one host
 * value; this module never imports another Feature. The account avatar URL
 * is written through the identity host because account rows are
 * provider-owned; only the `assets` rows are written here.
 */
export function createAssetRoutes(host: UsersServerHost) {
  const guard = createGuard((context) => host.resolveActor(getCookie(context, host.sessionCookieName)));
  return new Hono()
    .post('/avatar', guard.signedIn, uploadAvatarHandlerFor(host, guard))
    .get('/avatar/:filename', serveAvatarHandlerFor(host));
}
