import { db } from '../config/database.js';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  role: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export class UserModel {
  static tableName = 'users';

  static async findById(id: string): Promise<User | undefined> {
    return db(this.tableName).where({ id }).first();
  }

  static async findByEmail(email: string): Promise<User | undefined> {
    return db(this.tableName).where({ email }).first();
  }

  static async create(data: Partial<User>): Promise<number[]> {
    return db(this.tableName).insert(data);
  }

  static async update(id: string, data: Partial<User>): Promise<number> {
    return db(this.tableName).where({ id }).update(data);
  }

  static async delete(id: string): Promise<number> {
    return db(this.tableName).where({ id }).delete();
  }

  static async all(): Promise<User[]> {
    return db(this.tableName).select('*');
  }
}
