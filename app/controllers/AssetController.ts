import { randomUUID } from "crypto";
import type { NaraRequest, NaraResponse } from "@core";
import { BaseController, jsonError, jsonServerError, jsonSuccess } from "@core";
import fs from "fs";
import path from "path";
import sharp from "sharp";  
import { Asset, User } from "@models";
import Logger from "@services/Logger";
import { Storage } from '@services';
import { UPLOAD } from '@config/constants';

// File upload security constants
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Cache object to store file contents in memory
let cache: { [key: string]: Buffer } = {};

type UploadSuccessResult = { ok: true; url: string };
type UploadErrorResult = { ok: false; message: string; code: string; status: number };
type UploadResult = UploadSuccessResult | UploadErrorResult;

class AssetController extends BaseController {
    /**
     * Serves assets from the dist folder (compiled assets)
     * - Handles CSS and JS files with proper content types
     * - Implements file caching for better performance
     * - Sets appropriate cache headers for browser caching
     */

    public async uploadAsset(request: NaraRequest, response: NaraResponse) {
        this.requireAuth(request);

        // Store user reference for use in nested callbacks
        const userId = request.user.id;
        Logger.debug('Avatar upload started', { userId });

        let uploadResult: UploadResult | null = null;
        let fileProcessed = false;
        let fileProcessingPromise: Promise<void> | null = null;

        try {
            await request.multipart((field: any) => {
                if (field.file) {
                    if (fileProcessed) {
                        uploadResult = {
                            ok: false,
                            message: 'Hanya satu file yang diizinkan per upload',
                            code: 'MULTIPLE_FILES_NOT_ALLOWED',
                            status: 400
                        };
                        return;
                    }

                    fileProcessed = true;

                    // Validate MIME type
                    if (!ALLOWED_MIME_TYPES.includes(field.mime_type)) {
                        Logger.debug('Invalid file mime_type', { mimeType: field.mime_type, userId });
                        uploadResult = {
                            ok: false,
                            message: "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
                            code: "INVALID_FILE_TYPE",
                            status: 400
                        };
                        return;
                    }

                    const id = randomUUID();
                    const fileName = `${id}.webp`; 

                    fileProcessingPromise = new Promise<void>((resolve, reject) => {
                        const chunks: Buffer[] = [];
                        const readable = field.file.stream;
                        let totalBytes = 0;
                        let streamEnded = false;

                        readable.on('data', (chunk: Buffer) => {
                            totalBytes += chunk.length;

                            if (totalBytes > MAX_FILE_SIZE_BYTES) {
                                readable.destroy(new Error('FILE_TOO_LARGE'));
                                return;
                            }

                            chunks.push(chunk);
                        });

                        readable.on('error', (error: Error) => {
                            if (error.message === 'FILE_TOO_LARGE') {
                                uploadResult = {
                                    ok: false,
                                    message: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`,
                                    code: 'FILE_TOO_LARGE',
                                    status: 413
                                };
                                return resolve();
                            }

                            reject(error);
                        });

                        readable.on('end', async () => {
                            if (streamEnded) {
                                return;
                            }

                            streamEnded = true;

                            try {
                                const buffer = Buffer.concat(chunks);
                                Logger.debug('Avatar upload buffer received', { size: buffer.length, userId });

                                const processedBuffer = await sharp(buffer)
                                    .webp({ quality: 80 })
                                    .resize(1200, 1200, {
                                        fit: 'inside',
                                        withoutEnlargement: true
                                    })
                                    .toBuffer();
                                Logger.debug('Avatar image processed', { processedSize: processedBuffer.length, userId });

                                const storedFile = await Storage.put(processedBuffer, {
                                    directory: UPLOAD.AVATAR_DIR,
                                    name: id,
                                    extension: 'webp'
                                });
                                Logger.debug('Avatar file stored', { url: storedFile.url, userId });

                                const publicUrl = storedFile.url;

                                await Asset.create({
                                    id,
                                    type: 'image',
                                    url: publicUrl,
                                    mime_type: 'image/webp',
                                    name: fileName,
                                    size: processedBuffer.length,
                                    user_id: userId,
                                });

                                await User.updateAvatar(userId, publicUrl);

                                Logger.debug('Avatar upload completed', { url: publicUrl, userId });
                                uploadResult = { ok: true, url: publicUrl };
                                resolve();
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                }
            });

            if (fileProcessingPromise) {
                await fileProcessingPromise;
            }

            if (!fileProcessed) {
                return jsonError(response, 'File avatar wajib diisi', 400, 'FILE_REQUIRED');
            }

            if (!uploadResult) {
                return jsonServerError(response, 'Upload avatar gagal diproses');
            }

            const result = uploadResult as UploadResult;

            if (!result.ok) {
                return jsonError(response, result.message, result.status, result.code);
            }

            return jsonSuccess(response, 'Avatar berhasil diupload', { url: result.url });
        } catch (error) {
            Logger.error('Error uploading asset', error as Error);
            return jsonServerError(response, "Internal server error");
        }
    }

    public async distFolder(request: NaraRequest, response: NaraResponse) {
        const file = request.params.file;

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
            if (cache[file]) {
                return response.send(cache[file]);
            }

            // Check if file exists and serve it
            if (await fs.promises.access(filePath).then(() => true).catch(() => false)) {
                const fileContent = await fs.promises.readFile(filePath);
                
                // Cache the file content
                cache[file] = fileContent;

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
