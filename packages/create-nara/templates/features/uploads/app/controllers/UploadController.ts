import { BaseController, jsonSuccess, jsonError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { AssetModel } from '../models/Asset.js';
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

  async uploadAsset(req: NaraRequest, res: NaraResponse) {
    try {
      const contentType = req.headers['content-type'] || '';

      if (!contentType.includes('multipart/form-data')) {
        return jsonError(res, 'Content-Type must be multipart/form-data', 400);
      }

      // Get raw body as buffer
      const buffer = await req.buffer();

      // Generate unique filename and ID
      const id = crypto.randomUUID();
      const filename = `${id}.webp`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // Process and save image with sharp
      const processed = await sharp(buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filepath);

      // Get file stats for size
      const stats = fs.statSync(filepath);

      // Save asset record to database
      await AssetModel.create({
        id,
        name: filename,
        type: 'image',
        url: `/uploads/${filename}`,
        mime_type: 'image/webp',
        size: stats.size,
        s3_key: null,
        user_id: req.user?.id || null,
      });

      return jsonSuccess(res, {
        id,
        filename,
        path: `/uploads/${filename}`,
        size: stats.size,
        mime_type: 'image/webp',
      }, 'File uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      return jsonError(res, 'Failed to upload file', 500);
    }
  }

  async deleteAsset(req: NaraRequest, res: NaraResponse) {
    try {
      const { id } = req.params;

      // Find asset in database
      const asset = await AssetModel.findById(id);
      if (!asset) {
        return jsonError(res, 'Asset not found', 404);
      }

      // Delete file from filesystem
      const filename = path.basename(asset.url);
      const filepath = path.join(UPLOAD_DIR, filename);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Delete asset record from database
      await AssetModel.delete(id);

      return jsonSuccess(res, { message: 'Asset deleted successfully' });
    } catch (error) {
      console.error('Delete error:', error);
      return jsonError(res, 'Failed to delete asset', 500);
    }
  }

  async getUserAssets(req: NaraRequest, res: NaraResponse) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return jsonError(res, 'Unauthorized', 401);
      }

      const assets = await AssetModel.findByUserId(userId);
      return jsonSuccess(res, { assets });
    } catch (error) {
      console.error('Get assets error:', error);
      return jsonError(res, 'Failed to get assets', 500);
    }
  }
}

export default new UploadController();
