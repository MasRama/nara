import { BaseController, jsonSuccess, ValidationError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import bcrypt from 'bcrypt';

export class UserController extends BaseController {
  async index(req: NaraRequest, res: NaraResponse) {
    // TODO: Implement pagination and filtering
    // const { page = 1, limit = 10, search, filter } = req.query;
    // const users = await UserModel.paginate({ page, limit, search, filter });

    return jsonSuccess(res, {
      users: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  }

  async store(req: NaraRequest, res: NaraResponse) {
    const { name, email, password, phone, is_admin, is_verified } = await req.json();

    if (!name || !email) {
      throw new ValidationError({
        name: !name ? ['Name is required'] : [],
        email: !email ? ['Email is required'] : [],
      });
    }

    // TODO: Create user in database
    // const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    // const user = await UserModel.create({ name, email, password: hashedPassword, phone, is_admin, is_verified });

    return jsonSuccess(res, {
      user: { id: '1', name, email, phone, is_admin, is_verified }
    }, 'User created successfully');
  }

  async update(req: NaraRequest, res: NaraResponse) {
    const { id } = req.params;
    const { name, email, password, phone, is_admin, is_verified } = await req.json();

    if (!name || !email) {
      throw new ValidationError({
        name: !name ? ['Name is required'] : [],
        email: !email ? ['Email is required'] : [],
      });
    }

    // TODO: Update user in database
    // const updateData: any = { name, email, phone, is_admin, is_verified };
    // if (password) {
    //   updateData.password = await bcrypt.hash(password, 10);
    // }
    // await UserModel.update(id, updateData);

    return jsonSuccess(res, {
      user: { id, name, email, phone, is_admin, is_verified }
    }, 'User updated successfully');
  }

  async destroy(req: NaraRequest, res: NaraResponse) {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError({
        ids: ['At least one user ID is required'],
      });
    }

    // TODO: Delete users from database
    // await UserModel.deleteMany(ids);

    return jsonSuccess(res, {}, `${ids.length} user(s) deleted successfully`);
  }
}
