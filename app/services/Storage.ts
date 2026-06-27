import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Logger from './Logger';

export interface StorageConfig {
  basePath: string;
  publicPath: string;
}

export interface StoredFile {
  path: string;
  fullPath: string;
  url: string;
  size: number;
  name: string;
}

export interface StoreOptions {
  name?: string;
  directory?: string;
  extension?: string;
}

let config: StorageConfig = {
  basePath: 'storage',
  publicPath: '/storage',
};

export const configure = (cfg: Partial<StorageConfig>): void => {
  config = { ...config, ...cfg };
};

const getBasePath = (): string =>
  path.resolve(process.cwd(), config.basePath);

export const put = async (buffer: Buffer, options: StoreOptions = {}): Promise<StoredFile> => {
  const fileName = options.name || randomUUID();
  const ext = options.extension ? `.${options.extension}` : '';
  const fullFileName = `${fileName}${ext}`;

  const directory = options.directory || '';
  const dirPath = path.join(getBasePath(), directory);
  const filePath = path.join(dirPath, fullFileName);
  const relativePath = path.join(directory, fullFileName);

  await fs.promises.mkdir(dirPath, { recursive: true });
  await fs.promises.writeFile(filePath, buffer);

  const stats = await fs.promises.stat(filePath);

  return {
    path: relativePath,
    fullPath: filePath,
    url: `${config.publicPath}/${relativePath}`.replace(/\\/g, '/'),
    size: stats.size,
    name: fullFileName,
  };
};

export const putFile = async (sourcePath: string, options: StoreOptions = {}): Promise<StoredFile> => {
  const buffer = await fs.promises.readFile(sourcePath);
  if (!options.extension) {
    options.extension = path.extname(sourcePath).slice(1);
  }
  return put(buffer, options);
};

export const get = async (relativePath: string): Promise<Buffer> =>
  fs.promises.readFile(path.join(getBasePath(), relativePath));

export const exists = async (relativePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(path.join(getBasePath(), relativePath));
    return true;
  } catch {
    return false;
  }
};

export const del = async (relativePath: string): Promise<boolean> => {
  try {
    await fs.promises.unlink(path.join(getBasePath(), relativePath));
    Logger.info(`File deleted: ${relativePath}`);
    return true;
  } catch (error) {
    Logger.error(`Failed to delete file: ${relativePath}`, error as Error);
    return false;
  }
};

export const url = (relativePath: string): string =>
  `${config.publicPath}/${relativePath}`.replace(/\\/g, '/');

export const filePath = (relativePath: string): string =>
  path.join(getBasePath(), relativePath);

const Storage = {
  configure, put, putFile, get, exists,
  delete: del, url, path: filePath,
};

export default Storage;
