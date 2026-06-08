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

  it('should copy a file', async () => {
    const buffer = Buffer.from('copy me');
    const file = await Storage.put(buffer, { directory: 'test' });
    
    const copied = await Storage.copy(file.path, 'test-copy/copied.txt');
    expect(await Storage.exists(copied.path)).toBe(true);
    expect(await Storage.exists(file.path)).toBe(true);
  });

  it('should move a file', async () => {
    const buffer = Buffer.from('move me');
    const file = await Storage.put(buffer, { directory: 'test' });
    
    const moved = await Storage.move(file.path, 'test-moved/moved.txt');
    expect(await Storage.exists(moved.path)).toBe(true);
    expect(await Storage.exists(file.path)).toBe(false);
  });

  it('should generate URL for file', () => {
    const url = Storage.url('images/photo.jpg');
    expect(url).toBe('/storage/images/photo.jpg');
  });

  it('should get file size', async () => {
    const buffer = Buffer.from('12345');
    const file = await Storage.put(buffer, { directory: 'test' });
    
    const size = await Storage.fileSize(file.path);
    expect(size).toBe(5);
  });

  it('should list files in directory', async () => {
    await Storage.put(Buffer.from('a'), { directory: 'list-test' });
    await Storage.put(Buffer.from('b'), { directory: 'list-test' });
    
    const fileList = await Storage.files('list-test');
    expect(fileList.length).toBe(2);
  });

  it('should create and delete directories', async () => {
    await Storage.makeDirectory('new-dir');
    expect(fs.existsSync(path.join(testDir, 'new-dir'))).toBe(true);
    
    await Storage.deleteDirectory('new-dir');
    expect(fs.existsSync(path.join(testDir, 'new-dir'))).toBe(false);
  });

  it('should return full file path', () => {
    const fp = Storage.filePath('images/photo.jpg');
    expect(fp).toContain('images/photo.jpg');
  });
});
