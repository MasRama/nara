/**
 * Asset Model
 *
 * Handles asset-related database operations.
 */
import { db } from "../config/database.js";

/**
 * Asset record interface
 */
export interface Asset {
  id: string;
  name: string | null;
  type: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  s3_key: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating a new asset
 */
export interface CreateAssetData {
  id: string;
  name?: string | null;
  type: string;
  url: string;
  mime_type?: string | null;
  size?: number | null;
  s3_key?: string | null;
  user_id?: string | null;
}

/**
 * Data for updating an asset
 */
export interface UpdateAssetData {
  name?: string | null;
  type?: string;
  url?: string;
  mime_type?: string | null;
  size?: number | null;
  s3_key?: string | null;
  user_id?: string | null;
}

export class AssetModel {
  static tableName = "assets";

  /**
   * Find asset by ID
   */
  static async findById(id: string): Promise<Asset | undefined> {
    return db(this.tableName).where("id", id).first();
  }

  /**
   * Find assets by user ID
   */
  static async findByUserId(userId: string): Promise<Asset[]> {
    return db(this.tableName).where("user_id", userId);
  }

  /**
   * Find assets by type
   */
  static async findByType(type: string): Promise<Asset[]> {
    return db(this.tableName).where("type", type);
  }

  /**
   * Find asset by S3 key
   */
  static async findByS3Key(s3Key: string): Promise<Asset | undefined> {
    return db(this.tableName).where("s3_key", s3Key).first();
  }

  /**
   * Get images for a user
   */
  static async getUserImages(userId: string): Promise<Asset[]> {
    return db(this.tableName)
      .where("user_id", userId)
      .where("type", "image");
  }

  /**
   * Create a new asset
   */
  static async create(data: CreateAssetData): Promise<number[]> {
    const now = new Date().toISOString();
    return db(this.tableName).insert({
      ...data,
      created_at: now,
      updated_at: now,
    });
  }

  /**
   * Update an asset by ID
   */
  static async update(id: string, data: UpdateAssetData): Promise<number> {
    return db(this.tableName)
      .where("id", id)
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      });
  }

  /**
   * Delete an asset by ID
   */
  static async delete(id: string): Promise<number> {
    return db(this.tableName).where("id", id).delete();
  }

  /**
   * Delete all assets for a user
   */
  static async deleteByUserId(userId: string): Promise<number> {
    return db(this.tableName).where("user_id", userId).delete();
  }

  /**
   * Get all assets
   */
  static async all(): Promise<Asset[]> {
    return db(this.tableName).select("*");
  }
}
