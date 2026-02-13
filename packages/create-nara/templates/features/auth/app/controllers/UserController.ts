import { BaseController, jsonSuccess, jsonError, ValidationError } from '@nara-web/core';
import type { NaraRequest, NaraResponse } from '@nara-web/core';
import { User } from '@models';
import { db } from '@config/database';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export class UserController extends BaseController {
  async index(req: NaraRequest, res: NaraResponse) {
    // Get query parameters
    const page = parseInt(req.query?.page as string) || 1;
    const limit = parseInt(req.query?.limit as string) || 10;
    const search = (req.query?.search as string) || '';
    const filter = (req.query?.filter as string) || 'all';
    const offset = (page - 1) * limit;

    // Build query
    let query = db('users').select(
      'id', 'name', 'email', 'phone', 'avatar', 'role',
      'email_verified_at', 'created_at', 'updated_at'
    );

    // Apply search filter
    if (search) {
      query = query.where(function() {
        this.where('name', 'like', `%${search}%`)
            .orWhere('email', 'like', `%${search}%`);
      });
    }

    // Apply role filter
    if (filter === 'admin') {
      query = query.where('role', 'admin');
    } else if (filter === 'user') {
      query = query.where('role', 'user');
    } else if (filter === 'verified') {
      query = query.whereNotNull('email_verified_at');
    } else if (filter === 'unverified') {
      query = query.whereNull('email_verified_at');
    }

    // Get total count for pagination
    const countQuery = query.clone();
    const [{ count: totalCount }] = await countQuery.count('* as count');
    const total = Number(totalCount);

    // Apply pagination and ordering
    const users = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Transform users to include is_admin and is_verified flags
    const transformedUsers = users.map(user => ({
      ...user,
      is_admin: user.role === 'admin',
      is_verified: !!user.email_verified_at
    }));

    const totalPages = Math.ceil(total / limit);

    return jsonSuccess(res, {
      users: transformedUsers,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
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

    // Check if email already exists
    const existing = await User.findByEmail(email);
    if (existing) {
      return jsonError(res, 'Email already registered', 400);
    }

    try {
      // Generate UUID for user ID
      const userId = randomUUID();
      
      // Hash password if provided, otherwise generate random
      const hashedPassword = password
        ? await bcrypt.hash(password, 10)
        : await bcrypt.hash(Math.random().toString(36).slice(-8), 10);

      // Create user in database
      await User.create({
        id: userId,
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        role: is_admin ? 'admin' : 'user',
        email_verified_at: is_verified ? new Date().toISOString() : null
      });

      // Fetch created user
      const user = await User.findById(userId);

      return jsonSuccess(res, {
        user: {
          id: user?.id,
          name: user?.name,
          email: user?.email,
          phone: user?.phone,
          avatar: user?.avatar,
          is_admin: user?.role === 'admin',
          is_verified: !!user?.email_verified_at
        }
      }, 'User created successfully');
    } catch (error: any) {
      // Handle UNIQUE constraint error (race condition)
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return jsonError(res, 'Email already registered', 400);
      }
      // Re-throw other errors for global error handler
      throw error;
    }
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

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return jsonError(res, 'User not found', 404);
    }

    // Check if email is taken by another user
    const emailUser = await User.findByEmail(email);
    if (emailUser && emailUser.id !== id) {
      throw new ValidationError({ email: ['Email already registered'] });
    }

    // Build update data
    const updateData: Record<string, any> = {
      name,
      email,
      phone: phone || null,
      role: is_admin ? 'admin' : 'user',
      email_verified_at: is_verified ? (existingUser.email_verified_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString()
    };

    // Hash new password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user in database
    await User.update(id, updateData);

    // Fetch updated user
    const user = await User.findById(id);

    return jsonSuccess(res, {
      user: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        phone: user?.phone,
        avatar: user?.avatar,
        is_admin: user?.role === 'admin',
        is_verified: !!user?.email_verified_at
      }
    }, 'User updated successfully');
  }

  async destroy(req: NaraRequest, res: NaraResponse) {
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError({
        ids: ['At least one user ID is required'],
      });
    }

    // Prevent deleting current user
    const currentUserId = req.user?.id;
    if (currentUserId && ids.includes(currentUserId)) {
      return jsonError(res, 'Cannot delete your own account', 400);
    }

    // Delete users from database
    const deleted = await db('users').whereIn('id', ids).delete();

    return jsonSuccess(res, { deleted }, `${deleted} user(s) deleted successfully`);
  }
}

export default new UserController();
