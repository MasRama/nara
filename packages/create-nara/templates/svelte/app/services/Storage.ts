/**
 * Storage Service
 *
 * Local file storage abstraction for NARA framework.
 * Provides a clean API for file operations.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Logger from './Logger';

export interface StorageConfig {
  basePath: string;      // Base storage directory (default: 'storage')
  publicPath: string;    // Public URL prefix (default: '/storage')
}

export interface StoredFile {
  path: string;          // Relative path from basePath
  fullPath: string;     // Absolute filesystem path
  url: string;          // Public URL
  size: number;         // File size in bytes
  name: string;         // File name
}

export interface StoreOptions {
  name?: string;         // Custom filename (without extension)
  directory?: string;   // Subdirectory within basePath
  extension?: string;   // File extension (e.g., 'webp', 'pdf')
}

class StorageService {
  private config: StorageConfig = {
    basePath: 'storage',
    publicPath: '/storage',
  };

  /**
   * Configure storage settings
   */
  configure(config: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the absolute base path
   */
  private getBasePath(): string {
    return path.resolve(process.cwd(), this.config.basePath);
  }

  /**
   * Store a file (Buffer)
   */
  async put(buffer: Buffer, options: StoreOptions = {}): Promise<StoredFile> {
    const fileName = options.name || randomUUID();
    const ext = options.extension ? `.${options.extension}` : '';
    const fullFileName = `${fileName}${ext}`;

    const directory = options.directory || '';
    const dirPath = path.join(this.getBasePath(), directory);
    const filePath = path.join(dirPath, fullFileName);
    const relativePath = path.join(directory, fullFileName);

    // Ensure directory exists
    await fs.promises.mkdir(dirPath, { recursive: true });

    // Write file
    await fs.promises.writeFile(filePath, buffer);

    const stats = await fs.promises.stat(filePath);

    return {
      path: relativePath,
      fullPath: filePath,
      url: `${this.config.publicPath}/${relativePath}`.replace(/\\/g, '/'),
      size: stats.size,
      name: fullFileName,
    };
  }

  /**
   * Store a file from path (copy)
   */
  async putFile(sourcePath: string, options: StoreOptions = {}): Promise<StoredFile> {
    const buffer = await fs.promises.readFile(sourcePath);

    if (!options.extension) {
      options.extension = path.extname(sourcePath).slice(1);
    }

    return this.put(buffer, options);
  }

  /**
   * Get file as Buffer
   */
  async get(relativePath: string): Promise<Buffer> {
    const fullPath = path.join(this.getBasePath(), relativePath);
    return fs.promises.readFile(fullPath);
  }

  /**
   * Get file stream (for large files)
   */
  getStream(relativePath: string): fs.ReadStream {
    const fullPath = path.join(this.getBasePath(), relativePath);
    return fs.createReadStream(fullPath);
  }

  /**
   * Check if file exists
   */
  async exists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.getBasePath(), relativePath);
    try {
      await fs.promises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   */
  async delete(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.getBasePath(), relativePath);
    try {
      await fs.promises.unlink(fullPath);
      Logger.info(`File deleted: ${relativePath}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to delete file: ${relativePath}`, error as Error);
      return false;
    }
  }

  /**
   * Move a file
   */
  async move(from: string, to: string): Promise<StoredFile> {
    const sourcePath = path.join(this.getBasePath(), from);
    const destPath = path.join(this.getBasePath(), to);

    // Ensure destination directory exists
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

    await fs.promises.rename(sourcePath, destPath);

    const stats = await fs.promises.stat(destPath);

    return {
      path: to,
      fullPath: destPath,
      url: `${this.config.publicPath}/${to}`.replace(/\\/g, '/'),
      size: stats.size,
      name: path.basename(to),
    };
  }

  /**
   * Copy a file
   */
  async copy(from: string, to: string): Promise<StoredFile> {
    const sourcePath = path.join(this.getBasePath(), from);
    const destPath = path.join(this.getBasePath(), to);

    // Ensure destination directory exists
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

    await fs.promises.copyFile(sourcePath, destPath);

    const stats = await fs.promises.stat(destPath);

    return {
      path: to,
      fullPath: destPath,
      url: `${this.config.publicPath}/${to}`.replace(/\\/g, '/'),
      size: stats.size,
      name: path.basename(to),
    };
  }

  /**
   * Get public URL for a file
   */
  url(relativePath: string): string {
    return `${this.config.publicPath}/${relativePath}`.replace(/\\/g, '/');
  }

  /**
   * Get absolute path for a file
   */
  path(relativePath: string): string {
    return path.join(this.getBasePath(), relativePath);
  }

  /**
   * Get file size
   */
  async size(relativePath: string): Promise<number> {
    const fullPath = path.join(this.getBasePath(), relativePath);
    const stats = await fs.promises.stat(fullPath);
    return stats.size;
  }

  /**
   * List files in a directory
   */
  async files(directory: string = ''): Promise<string[]> {
    const dirPath = path.join(this.getBasePath(), directory);
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile())
        .map(entry => path.join(directory, entry.name));
    } catch {
      return [];
    }
  }

  /**
   * List directories
   */
  async directories(directory: string = ''): Promise<string[]> {
    const dirPath = path.join(this.getBasePath(), directory);
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(directory, entry.name));
    } catch {
      return [];
    }
  }

  /**
   * Delete a directory and all its contents
   */
  async deleteDirectory(directory: string): Promise<boolean> {
    const dirPath = path.join(this.getBasePath(), directory);
    try {
      await fs.promises.rm(dirPath, { recursive: true, force: true });
      Logger.info(`Directory deleted: ${directory}`);
      return true;
    } catch (error) {
      Logger.error(`Failed to delete directory: ${directory}`, error as Error);
      return false;
    }
  }

  /**
   * Make a directory
   */
  async makeDirectory(directory: string): Promise<boolean> {
    const dirPath = path.join(this.getBasePath(), directory);
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}

export const Storage = new StorageService();
export default Storage;
