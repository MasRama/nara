import { BaseController, jsonSuccess, ValidationError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import bcrypt from 'bcrypt';

export class ProfileController extends BaseController {
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

    // TODO: Handle file upload
    // This requires multipart form handling which depends on the upload middleware
    // For now, return a placeholder response

    // Example implementation:
    // const file = await req.file();
    // const filename = `avatars/${user.id}-${Date.now()}.${file.extension}`;
    // await saveFile(file, filename);
    // await UserModel.updateAvatar(user.id, `/uploads/${filename}`);
    // return jsonSuccess(res, { url: `/uploads/${filename}` }, 'Avatar uploaded successfully');

    return jsonSuccess(res, {
      url: '/uploads/avatars/default.png'
    }, 'Avatar uploaded successfully');
  }
}
