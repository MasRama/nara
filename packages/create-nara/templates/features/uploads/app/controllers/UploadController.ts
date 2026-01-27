import { BaseController, jsonSuccess, jsonError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = './uploads';

export class UploadController extends BaseController {
  constructor() {
    super();
    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async upload(req: NaraRequest, res: NaraResponse) {
    try {
      const contentType = req.headers['content-type'] || '';

      if (!contentType.includes('multipart/form-data')) {
        return jsonError(res, 'Content-Type must be multipart/form-data', 400);
      }

      // Get raw body as buffer
      const buffer = await req.buffer();

      // Generate unique filename
      const filename = `${crypto.randomUUID()}.webp`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // Process and save image with sharp
      await sharp(buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filepath);

      return jsonSuccess(res, {
        filename,
        path: `/uploads/${filename}`,
        message: 'File uploaded successfully',
      }, 201);
    } catch (error) {
      console.error('Upload error:', error);
      return jsonError(res, 'Failed to upload file', 500);
    }
  }

  async delete(req: NaraRequest, res: NaraResponse) {
    const { filename } = req.params;
    const filepath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filepath)) {
      return jsonError(res, 'File not found', 404);
    }

    fs.unlinkSync(filepath);
    return jsonSuccess(res, { message: 'File deleted successfully' });
  }
}
