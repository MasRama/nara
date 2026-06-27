import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Storage from '../../app/services/Storage';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Storage', () => {
  const testDir = path.join(os.tmpdir(), 'nara-storage-test');

  beforeEach(() => {
    Storage.configure({ basePath: testDir, publicPath: '/storage' });
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it('should store and retrieve a buffer', async () => {
    const buffer = Buffer.from('hello world');
    const file = await Storage.put(buffer, { directory: 'test' });

    expect(file.path).toContain('test/');
    expect(file.size).toBe(11);

    const retrieved = await Storage.get(file.path);
    expect(retrieved.toString()).toBe('hello world');
  });

  it('should check if file exists', async () => {
    const buffer = Buffer.from('test');
    const file = await Storage.put(buffer, { directory: 'test' });

    expect(await Storage.exists(file.path)).toBe(true);
    expect(await Storage.exists('nonexistent.txt')).toBe(false);
  });

  it('should delete a file', async () => {
    const buffer = Buffer.from('delete me');
    const file = await Storage.put(buffer, { directory: 'test' });

    expect(await Storage.exists(file.path)).toBe(true);
    await Storage.del(file.path);
    expect(await Storage.exists(file.path)).toBe(false);
  });

  it('should generate URL for file', () => {
    const url = Storage.url('images/photo.jpg');
    expect(url).toBe('/storage/images/photo.jpg');
  });

  it('should return full file path', () => {
    const fp = Storage.filePath('images/photo.jpg');
    expect(fp).toContain('images/photo.jpg');
  });
});
