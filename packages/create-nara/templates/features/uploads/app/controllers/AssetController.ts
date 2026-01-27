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



// Cache object to store file contents in memory
let cache: { [key: string]: Buffer } = {};

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
        console.log('[AVATAR DEBUG] Upload started for user:', userId);

        try { 
            let isValidFile = true;

            await request.multipart(async (field: any) => {
                if (field.file) {
                    if (!field.mime_type.includes("image")) {
                        console.log('[AVATAR DEBUG] File mime_type:', field.mime_type);
                        isValidFile = false;
                        return;
                    }

                    const id = randomUUID();
                    const fileName = `${id}.webp`; 

                    // Create a buffer to store the image data
                    const chunks: Buffer[] = [];
                    const readable = field.file.stream;

                    readable.on('data', (chunk: Buffer) => {
                        chunks.push(chunk);
                    });

                    readable.on('end', async () => {
                        const buffer = Buffer.concat(chunks);
                        console.log('[AVATAR DEBUG] Total buffer length received:', buffer.length);

                        try {
                            // Process image with Sharp and get buffer
                            const processedBuffer = await sharp(buffer)
                                .webp({ quality: 80 }) // Convert to WebP with 80% quality
                                .resize(1200, 1200, { // Resize to max 1200x1200 while maintaining aspect ratio
                                    fit: 'inside',
                                    withoutEnlargement: true
                                })
                                .toBuffer();
                            console.log('[AVATAR DEBUG] Processed buffer length (WebP):', processedBuffer.length);

                            // Store processed image using Storage service
                            const storedFile = await Storage.put(processedBuffer, {
                                directory: UPLOAD.AVATAR_DIR,
                                name: id,
                                extension: 'webp'
                            });
                            console.log('[AVATAR DEBUG] File stored at:', storedFile.url);

                            // Build public URL for the saved file
                            const publicUrl = storedFile.url;

                            // Save to assets table with local file reference
                            await Asset.create({
                                id,
                                type: 'image',
                                url: publicUrl,
                                mime_type: 'image/webp',
                                name: fileName,
                                size: processedBuffer.length,
                                user_id: userId,
                            });

                            // Update user avatar in users table
                            await User.updateAvatar(userId, publicUrl);

                            // Return success response with public URL
                            console.log('[AVATAR DEBUG] Returning public URL:', publicUrl);
                            jsonSuccess(response, 'Avatar berhasil diupload', { url: publicUrl });
                        } catch (err) {
                            Logger.error('Error processing and uploading image', err as Error);
                            jsonServerError(response, 'Gagal memproses dan mengupload gambar');
                        }
                    });
                }
            });

            if (!isValidFile) {
                return jsonError(response, "Invalid file type. Only images are allowed.", 400, "INVALID_FILE_TYPE");
            }

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