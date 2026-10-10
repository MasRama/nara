import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from '../../../shared/database';
import type { UserProfile } from '../contract';
import { createUserAsset } from '../server/assets';
import { createUsersMaintenance } from '../server/maintenance';

const LIVING_OWNER = 'living-owner';

function hostWith(deleteStored: (key: string) => Promise<boolean>) {
  return {
    findAccountById: (userId: string) => (userId === LIVING_OWNER ? ({ id: userId } as UserProfile) : undefined),
    assetStorage: { put: vi.fn(), get: vi.fn(), delete: vi.fn(deleteStored) },
  };
}

function avatarOf(userId: string) {
  const id = randomUUID();
  return createUserAsset({
    id,
    name: 'avatar.webp',
    type: 'avatar',
    url: `/api/assets/avatar/${id}.webp`,
    mimeType: 'image/webp',
    size: 10,
    storageKey: `avatars/${id}.webp`,
    userId,
  });
}

const assetExists = (id: string) => getDatabase().prepare('SELECT 1 FROM assets WHERE id = ?').get(id) !== undefined;

function sweep(host: ReturnType<typeof hostWith>) {
  const [task] = createUsersMaintenance(host);
  return task.run(Date.now());
}

describe('Users maintenance', () => {
  beforeEach(() => {
    getDatabase().prepare('DELETE FROM assets').run();
  });

  // Account deletion commits before avatar cleanup; a crash in between must not leave them forever.
  it('removes the assets and stored files of an account that no longer exists', () => {
    const host = hostWith(async () => true);
    const orphan = avatarOf('deleted-account');
    const kept = avatarOf(LIVING_OWNER);

    expect(sweep(host)).toEqual({ removed: 1 });

    expect(assetExists(orphan.id)).toBe(false);
    expect(assetExists(kept.id)).toBe(true);
    expect(host.assetStorage.delete).toHaveBeenCalledWith(orphan.storage_key);
    expect(host.assetStorage.delete).not.toHaveBeenCalledWith(kept.storage_key);
  });

  // Before Users stopped referencing Auth's table, deleting an account set the owner to NULL.
  it('removes assets left without any owner by an older deletion', () => {
    const host = hostWith(async () => true);
    const legacy = avatarOf('deleted-account');
    getDatabase().prepare('UPDATE assets SET user_id = NULL WHERE id = ?').run(legacy.id);

    expect(sweep(host)).toEqual({ removed: 1 });

    expect(assetExists(legacy.id)).toBe(false);
    expect(host.assetStorage.delete).toHaveBeenCalledWith(legacy.storage_key);
  });

  it('reports nothing when every asset still has its owner', () => {
    avatarOf(LIVING_OWNER);
    expect(sweep(hostWith(async () => true))).toBeUndefined();
  });

  it('keeps sweeping when the stored file cannot be deleted', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const orphan = avatarOf('deleted-account');
      expect(() => sweep(hostWith(async () => Promise.reject(new Error('provider down'))))).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(assetExists(orphan.id)).toBe(false);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
