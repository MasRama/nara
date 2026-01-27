import { BaseController, jsonSuccess, jsonError, ValidationError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ProfileController extends BaseController {
  private avatarDir = './uploads/avatars';

  constructor() {
    super();
    // Ensure avatar directory exists
    if (!fs.existsSync(this.avatarDir)) {
      fs.mkdirSync(this.avatarDir, { recursive: true });
    }
  }

  async update(req: NaraRequest, res: NaraResponse) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { name, email, phone } = await req.json();

    if (!name || !email) {
      throw new ValidationError({
        name: !name ? ['Name is required'] : [],
        email: !email ? ['Email is required'] : [],
      });
    }

    // TODO: Update user in database
    // await UserModel.update(user.id, { name, email, phone });

    return jsonSuccess(res, {
      user: { ...user, name, email, phone }
    }, 'Profile updated successfully');
  }

  async changePassword(req: NaraRequest, res: NaraResponse) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { current_password, new_password } = await req.json();

    if (!current_password || !new_password) {
      throw new ValidationError({
        current_password: !current_password ? ['Current password is required'] : [],
        new_password: !new_password ? ['New password is required'] : [],
      });
    }

    if (new_password.length < 6) {
      throw new ValidationError({
        new_password: ['Password must be at least 6 characters'],
      });
    }

    // TODO: Verify current password and update
    // const dbUser = await UserModel.findById(user.id);
    // if (!await bcrypt.compare(current_password, dbUser.password)) {
    //   throw new ValidationError({ current_password: ['Current password is incorrect'] });
    // }
    // const hashedPassword = await bcrypt.hash(new_password, 10);
    // await UserModel.updatePassword(user.id, hashedPassword);

    return jsonSuccess(res, {}, 'Password changed successfully');
  }

  async uploadAvatar(req: NaraRequest, res: NaraResponse) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      // Get raw body as buffer
      const buffer = await req.buffer();

      if (!buffer || buffer.length === 0) {
        return jsonError(res, 'No file uploaded', 400);
      }

      // Extract image from multipart form data
      const boundary = req.headers['content-type']?.split('boundary=')[1];
      if (!boundary) {
        return jsonError(res, 'Invalid multipart form data', 400);
      }

      // Find image data in multipart
      const parts = buffer.toString('binary').split(`--${boundary}`);
      let imageBuffer: Buffer | null = null;

      for (const part of parts) {
        if (part.includes('Content-Type: image/')) {
          const dataStart = part.indexOf('\r\n\r\n') + 4;
          const dataEnd = part.lastIndexOf('\r\n');
          if (dataStart > 4 && dataEnd > dataStart) {
            imageBuffer = Buffer.from(part.slice(dataStart, dataEnd), 'binary');
            break;
          }
        }
      }

      if (!imageBuffer) {
        return jsonError(res, 'No image found in upload', 400);
      }

      // Generate unique filename
      const filename = `${crypto.randomUUID()}.webp`;
      const filepath = path.join(this.avatarDir, filename);

      // Process and save image with sharp
      await sharp(imageBuffer)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(filepath);

      const avatarUrl = `/uploads/avatars/${filename}`;

      // TODO: Update user avatar in database
      // await UserModel.updateAvatar(user.id, avatarUrl);

      return jsonSuccess(res, { url: avatarUrl }, 'Avatar uploaded successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      return jsonError(res, 'Failed to upload avatar', 500);
    }
  }
}
