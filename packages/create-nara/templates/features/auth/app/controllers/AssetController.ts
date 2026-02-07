/**
 * AssetController
 * 
 * Handles static file serving and asset uploads.
 */
import { randomUUID } from 'crypto';
import { BaseController, jsonError, jsonServerError, jsonSuccess } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Asset, User } from '@models';
import Logger from '@services/Logger';
import Storage from '@services/Storage';
import { UPLOAD } from '@config/constants';

// Cache object to store file contents in memory
let cache: { [key: string]: Buffer } = {};

class AssetController extends BaseController {
  /**
   * Upload avatar image
   */
  public async uploadAsset(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);

    const userId = request.user!.id;

    try {
      let isValidFile = true;

      await request.multipart(async (field: any) => {
        if (field.file) {
          if (!field.mime_type.includes('image')) {
            isValidFile = false;
            return;
          }

          const id = randomUUID();
          const fileName = `${id}.webp`;

          const chunks: Buffer[] = [];
          const readable = field.file.stream;

          readable.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          readable.on('end', async () => {
            const buffer = Buffer.concat(chunks);

            try {
              // Process image with Sharp
              const processedBuffer = await sharp(buffer)
                .webp({ quality: 80 })
                .resize(1200, 1200, {
                  fit: 'inside',
                  withoutEnlargement: true,
                })
                .toBuffer();

              // Store processed image
              const storedFile = await Storage.put(processedBuffer, {
                directory: UPLOAD.AVATAR_DIR,
                name: id,
                extension: 'webp',
              });

              const publicUrl = storedFile.url;

              // Save to assets table
              await Asset.create({
                id,
                type: 'image',
                url: publicUrl,
                mime_type: 'image/webp',
                name: fileName,
                size: processedBuffer.length,
                user_id: userId,
              });

              // Update user avatar
              await User.update(userId, { avatar: publicUrl });

              jsonSuccess(response, 'Avatar uploaded successfully', { url: publicUrl });
            } catch (err) {
              Logger.error('Error processing and uploading image', err as Error);
              jsonServerError(response, 'Failed to process and upload image');
            }
          });
        }
      });

      if (!isValidFile) {
        return jsonError(response, 'Invalid file type. Only images are allowed.', 400, 'INVALID_FILE_TYPE');
      }
    } catch (error) {
      Logger.error('Error uploading asset', error as Error);
      return jsonServerError(response, 'Internal server error');
    }
  }

  /**
   * Serves assets from the dist folder (compiled assets)
   */
  public async distFolder(request: NaraRequest, response: NaraResponse) {
    const file = request.params.file;

    try {
      const filePath = `dist/assets/${file}`;

      // Set appropriate content type
      if (file.endsWith('.css')) {
        response.setHeader('Content-Type', 'text/css');
      } else if (file.endsWith('.js')) {
        response.setHeader('Content-Type', 'application/javascript');
      } else {
        response.setHeader('Content-Type', 'application/octet-stream');
      }

      // Set cache control header (1 year)
      response.setHeader('Cache-Control', 'public, max-age=31536000');

      // Return cached content if available
      if (cache[file]) {
        return response.send(cache[file]);
      }

      // Check if file exists and serve it
      if (
        await fs.promises
          .access(filePath)
          .then(() => true)
          .catch(() => false)
      ) {
        const fileContent = await fs.promises.readFile(filePath);
        cache[file] = fileContent;
        return response.send(fileContent);
      }

      return response.status(404).send('File not found');
    } catch (error) {
      Logger.error('Error serving dist file', error as Error);
      return response.status(500).send('Internal server error');
    }
  }

  /**
   * Serves static files from the public/storage folder
   */
  public async publicFolder(request: NaraRequest, response: NaraResponse) {
    const allowedExtensions = [
      '.ico', '.png', '.jpeg', '.jpg', '.gif', '.svg', '.webp',
      '.txt', '.pdf', '.css', '.js',
      '.woff', '.woff2', '.ttf', '.eot',
      '.mp4', '.webm', '.mp3', '.wav',
    ];

    const requestedPath = decodeURIComponent(request.path);
    const relativePath = requestedPath.replace(/^\/+/, '');

    // Security: Block path traversal
    if (
      relativePath.includes('..') ||
      relativePath.includes('%2e') ||
      relativePath.includes('%2E') ||
      relativePath.includes('\0')
    ) {
      Logger.logSecurity('Path traversal attempt blocked', {
        requestedPath,
        ip: request.ip,
      });
      return response.status(403).send('Access denied');
    }

    // Check if path has extension
    if (!relativePath.includes('.')) {
      return response.status(404).send('Page not found');
    }

    // Validate file extension
    if (!allowedExtensions.some((ext) => relativePath.toLowerCase().endsWith(ext))) {
      return response.status(403).send('File type not allowed');
    }

    // Resolve paths
    const publicDir = path.resolve(process.cwd(), 'public');
    const storageDir = path.resolve(process.cwd(), 'storage');
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const resolvedPath = path.resolve(process.cwd(), relativePath);

    // Security: Ensure path is within allowed directories
    if (
      !resolvedPath.startsWith(publicDir) &&
      !resolvedPath.startsWith(storageDir) &&
      !resolvedPath.startsWith(uploadsDir)
    ) {
      Logger.logSecurity('Path traversal attempt blocked', {
        requestedPath,
        resolvedPath,
        ip: request.ip,
      });
      return response.status(403).send('Access denied');
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return response.status(404).send('File not found');
    }

    // Serve the file
    return response.download(resolvedPath);
  }
}

export default new AssetController();
export { AssetController };
