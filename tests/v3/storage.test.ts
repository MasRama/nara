// @vitest-environment node
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalAssetStorage } from '../../src/shared/storage';

describe('local asset storage substrate', () => {
  it('stores, reads, and deletes provider-neutral keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nara-storage-'));
    try {
      const storage = createLocalAssetStorage({ root });
      const data = Buffer.from('hello');
      await storage.put({ key: 'avatars/example.bin', data, contentType: 'application/octet-stream' });

      const stored = await storage.get('avatars/example.bin');
      expect(Buffer.from(stored?.data ?? [])).toEqual(data);
      expect(stored?.size).toBe(data.length);
      expect(await storage.delete('avatars/example.bin')).toBe(true);
      expect(await storage.get('avatars/example.bin')).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects traversal and refuses symlink escape reads', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nara-storage-root-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'nara-storage-outside-'));
    try {
      const storage = createLocalAssetStorage({ root });
      await expect(storage.put({ key: '../escape.bin', data: Buffer.from('x'), contentType: 'application/octet-stream' })).rejects.toThrow(/Invalid asset storage key/);

      await writeFile(path.join(outside, 'secret.bin'), 'secret');
      await symlink(outside, path.join(root, 'linked'));
      expect(await storage.get('linked/secret.bin')).toBeUndefined();
      expect(await storage.delete('linked/secret.bin')).toBe(false);
      await expect(
        storage.put({ key: 'linked/write.bin', data: Buffer.from('blocked'), contentType: 'application/octet-stream' }),
      ).rejects.toThrow(/outside configured root/);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });
});
