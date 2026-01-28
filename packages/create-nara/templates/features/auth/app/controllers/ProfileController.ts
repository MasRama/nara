import { BaseController, jsonSuccess, jsonError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { UserModel } from '../models/User.js';
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
      return res.redirect('/login');
    }

    const { name, email, phone } = await req.json();

    if (!name || !email) {
      res.cookie('error', 'Name and email are required', 5000);
      return res.redirect('/profile');
    }

    // Update user in database
    await UserModel.update(user.id, { name, email, phone });

    res.cookie('success', 'Profile updated successfully', 5000);
    return res.redirect('/profile');
  }

  async changePassword(req: NaraRequest, res: NaraResponse) {
    const user = req.user;
    if (!user) {
      return res.redirect('/login');
    }

    const { current_password, new_password } = await req.json();

    if (!current_password || !new_password) {
      res.cookie('error', 'Current password and new password are required', 5000);
      return res.redirect('/profile');
    }

    if (new_password.length < 6) {
      res.cookie('error', 'Password must be at least 6 characters', 5000);
      return res.redirect('/profile');
    }

    // Verify current password and update
    const dbUser = await UserModel.findById(user.id);
    if (!dbUser || !await bcrypt.compare(current_password, dbUser.password)) {
      res.cookie('error', 'Current password is incorrect', 5000);
      return res.redirect('/profile');
    }
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await UserModel.update(user.id, { password: hashedPassword });

    res.cookie('success', 'Password changed successfully', 5000);
    return res.redirect('/profile');
  }

  async uploadAvatar(req: NaraRequest, res: NaraResponse) {
    const user = req.user;
    if (!user) {
      return res.redirect('/login');
    }

    try {
      // Get raw body as buffer
      const buffer = await req.buffer();

      if (!buffer || buffer.length === 0) {
        res.cookie('error', 'No file uploaded', 5000);
        return res.redirect('/profile');
      }

      // Extract image from multipart form data
      const boundary = req.headers['content-type']?.split('boundary=')[1];
      if (!boundary) {
        res.cookie('error', 'Invalid multipart form data', 5000);
        return res.redirect('/profile');
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
        res.cookie('error', 'No image found in upload', 5000);
        return res.redirect('/profile');
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

      // Update user avatar in database
      await UserModel.update(user.id, { avatar: avatarUrl });

      // Return JSON for AJAX upload (not redirect)
      return jsonSuccess(res, { url: avatarUrl }, 'Avatar uploaded successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      return jsonError(res, 'Failed to upload avatar', 500);
    }
  }
}
