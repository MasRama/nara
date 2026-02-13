/**
 * Asset Model
 * 
 * Handles asset-related database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";

/**
 * Asset record interface
 */
export interface AssetRecord extends BaseRecord {
  id: string;
  name: string | null;
  type: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  s3_key: string | null;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
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

class AssetModel extends BaseModel<AssetRecord> {
  protected tableName = "assets";
  protected timestampOptions = {
    useTimestamps: true,
    timestampFormat: 'datetime' as const
  };

  /**
   * Find assets by user ID
   */
  async findByUserId(userId: string): Promise<AssetRecord[]> {
    return this.query().where("user_id", userId);
  }

  /**
   * Find assets by type
   */
  async findByType(type: string): Promise<AssetRecord[]> {
    return this.query().where("type", type);
  }

  /**
   * Find asset by S3 key
   */
  async findByS3Key(s3Key: string): Promise<AssetRecord | undefined> {
    return this.query().where("s3_key", s3Key).first();
  }

  /**
   * Get images for a user
   */
  async getUserImages(userId: string): Promise<AssetRecord[]> {
    return this.query()
      .where("user_id", userId)
      .where("type", "image");
  }

  /**
   * Delete all assets for a user
   */
  async deleteByUserId(userId: string): Promise<number> {
    return this.query().where("user_id", userId).delete();
  }
}

export const Asset = new AssetModel();
export default Asset;
