import { randomUUID } from "crypto";
import type { NaraRequest, NaraResponse } from "@core";
import { BaseController, jsonError, jsonServerError, jsonSuccess } from "@core";
import fs from "fs";
import path from "path";
import sharp from "sharp";  
import multer from "multer";
import { Asset, User } from "@models";
import Logger from "@services/Logger";
import { Storage } from '@services';
import { assetCache } from '@services/CacheStore';
import { UPLOAD } from '@config/constants';

// File upload security constants
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

type UploadSuccessResult = { ok: true; url: string };
type UploadErrorResult = { ok: false; message: string; code: string; status: number };
type UploadResult = UploadSuccessResult | UploadErrorResult;

/**
 * Multer configuration for avatar uploads
 * - memoryStorage: keeps file in memory as Buffer (for sharp processing)
 * - fileFilter: validates MIME type before accepting
 * - limits: enforces max file size
 */
const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('INVALID_FILE_TYPE'));
        }
    },
});

class AssetController extends BaseController {
    /**
     * Multer middleware for avatar upload (single file, field name: 'file')
     */
    public avatarMiddleware = avatarUpload.single('file');

    /**
     * Upload avatar endpoint
     * Receives file via multer middleware, processes with sharp, stores result
     */
    public async uploadAsset(request: NaraRequest, response: NaraResponse) {
        this.requireAuth(request);

        const userId = request.user.id;
        Logger.debug('Avatar upload started', { userId });

        try {
            const file = (request as any).file as { buffer: Buffer; mimetype: string; originalname: string } | undefined;

            if (!file) {
                return jsonError(response, 'File avatar wajib diisi', 400, 'FILE_REQUIRED');
            }

            Logger.debug('Avatar upload buffer received', { size: file.buffer.length, userId });

            // Process image with sharp
            const id = randomUUID();
            const processedBuffer = await sharp(file.buffer)
                .webp({ quality: 80 })
                .resize(1200, 1200, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toBuffer();

            Logger.debug('Avatar image processed', { processedSize: processedBuffer.length, userId });

            // Store file
            const storedFile = await Storage.put(processedBuffer, {
                directory: UPLOAD.AVATAR_DIR,
                name: id,
                extension: 'webp'
            });

            Logger.debug('Avatar file stored', { url: storedFile.url, userId });

            // Create asset record
            await Asset.create({
                id,
                type: 'image',
                url: storedFile.url,
                mime_type: 'image/webp',
                name: `${id}.webp`,
                size: processedBuffer.length,
                user_id: userId,
            });

            // Update user avatar
            await User.updateAvatar(userId, storedFile.url);

            Logger.debug('Avatar upload completed', { url: storedFile.url, userId });

            return jsonSuccess(response, 'Avatar berhasil diupload', { url: storedFile.url });
        } catch (error) {
            const err = error as Error;
            
            if (err.message === 'INVALID_FILE_TYPE') {
                return jsonError(response, "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.", 400, "INVALID_FILE_TYPE");
            }
            
            if (err.message === 'LIMIT_FILE_SIZE' || (err as any).code === 'LIMIT_FILE_SIZE') {
                return jsonError(response, `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`, 413, 'FILE_TOO_LARGE');
            }

            Logger.error('Error uploading asset', err);
            return jsonServerError(response, "Internal server error");
        }
    }

    public async distFolder(request: NaraRequest, response: NaraResponse) {
        const file = request.params.file as string;

        try {
            const filePath = `dist/assets/${file}`;

            // Set appropriate content type based on file extension
            if (file.endsWith(".css")) {
                response.setHeader("Content-Type", "text/css");
            } else if (file.endsWith(".js")) {
                response.setHeader("Content-Type", "application/javascript");
            } else {
                response.setHeader("Content-Type", "application/octet-stream");
            }

            // Set cache control header for browser caching (1 year)
            response.setHeader("Cache-Control", "public, max-age=31536000");

            // Return cached content if available
            const cached = assetCache.get(file);
            if (cached) {
                return response.send(cached);
            }

            // Check if file exists and serve it
            if (await fs.promises.access(filePath).then(() => true).catch(() => false)) {
                const fileContent = await fs.promises.readFile(filePath);
                
                // Cache the file content (bounded LRU with TTL)
                assetCache.set(file, fileContent);

                return response.send(fileContent);
            }

            return response.status(404).send("File not found");
        } catch (error) {
            Logger.error('Error serving dist file', error as Error);
            return response.status(500).send("Internal server error");
        }
    }

    /**
     * Serves static files from the public folder
     * - Implements security by checking allowed file extensions
     * - Prevents directory traversal attacks
     * - Handles various file types (images, fonts, documents, etc.)
     */
    public async publicFolder(request: NaraRequest, response: NaraResponse) {
        // List of allowed file extensions for security
        const allowedExtensions = [
            '.ico', '.png', '.jpeg', '.jpg', '.gif', '.svg', '.webp',
            '.txt', '.pdf', '.css', '.js',
            '.woff', '.woff2', '.ttf', '.eot',
            '.mp4', '.webm', '.mp3', '.wav'
        ];

        // Get the requested path and decode URL encoding
        const requestedPath = decodeURIComponent(request.path);

        // Security: Remove leading slash and normalize
        const relativePath = requestedPath.replace(/^\/+/, '');

        // Security: Check for path traversal attempts BEFORE any path operations
        // Block any path containing .. or encoded variants
        if (relativePath.includes('..') ||
            relativePath.includes('%2e') ||
            relativePath.includes('%2E') ||
            relativePath.includes('\0')) {
            Logger.logSecurity('Path traversal attempt blocked', {
                requestedPath,
                ip: request.ip
            });
            return response.status(403).send('Access denied');
        }

        // Check if the path has any extension
        if (!relativePath.includes('.')) {
            return response.status(404).send('Page not found');
        }

        // Security check: validate file extension
        if (!allowedExtensions.some(ext => relativePath.toLowerCase().endsWith(ext))) {
            return response.status(403).send('File type not allowed');
        }

        // Resolve the absolute path and verify it's within public directory
        const publicDir = path.resolve(process.cwd(), 'public');
        const storageDir = path.resolve(process.cwd(), 'storage');
        const resolvedPath = path.resolve(process.cwd(), relativePath);

        // Security: Ensure the resolved path is within the public or storage directory
        if (!resolvedPath.startsWith(publicDir) && !resolvedPath.startsWith(storageDir)) {
            Logger.logSecurity('Path traversal attempt blocked (resolved path escape)', {
                requestedPath,
                resolvedPath,
                publicDir,
                storageDir,
                ip: request.ip
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
