/**
 * BackupFile Model
 * 
 * Handles backup file database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";

/**
 * BackupFile record interface
 */
export interface BackupFileRecord extends BaseRecord {
  id: string;
  key: string;
  file_name: string;
  file_size: number | null;
  compression: string;
  storage: string;
  checksum: string | null;
  uploaded_at: number;
  deleted_at: number | null;
  encryption: string | null;
  enc_iv: string | null;
  enc_tag: string | null;
}

/**
 * Data for creating a new backup file
 */
export interface CreateBackupFileData {
  id: string;
  key: string;
  file_name: string;
  file_size?: number | null;
  compression?: string;
  storage?: string;
  checksum?: string | null;
  uploaded_at: number;
  deleted_at?: number | null;
  encryption?: string | null;
  enc_iv?: string | null;
  enc_tag?: string | null;
}

/**
 * Data for updating a backup file
 */
export interface UpdateBackupFileData {
  key?: string;
  file_name?: string;
  file_size?: number | null;
  compression?: string;
  storage?: string;
  checksum?: string | null;
  deleted_at?: number | null;
  encryption?: string | null;
  enc_iv?: string | null;
  enc_tag?: string | null;
}

class BackupFileModel extends BaseModel<BackupFileRecord> {
  protected tableName = "backup_files";
  protected timestampOptions = {
    useTimestamps: false,
    timestampFormat: 'bigint' as const
  };

  /**
   * Find backup by key
   */
  async findByKey(key: string): Promise<BackupFileRecord | undefined> {
    return this.query().where("key", key).first();
  }

  /**
   * Get all active (non-deleted) backups
   */
  async getActive(): Promise<BackupFileRecord[]> {
    return this.query().whereNull("deleted_at").orderBy("uploaded_at", "desc");
  }

  /**
   * Get deleted backups
   */
  async getDeleted(): Promise<BackupFileRecord[]> {
    return this.query().whereNotNull("deleted_at").orderBy("deleted_at", "desc");
  }

  /**
   * Soft delete a backup
   */
  async softDelete(id: string): Promise<BackupFileRecord | undefined> {
    await this.query().where("id", id).update({
      deleted_at: Date.now()
    });
    return this.findById(id);
  }

  /**
   * Restore a soft-deleted backup
   */
  async restore(id: string): Promise<BackupFileRecord | undefined> {
    await this.query().where("id", id).update({
      deleted_at: null
    });
    return this.findById(id);
  }

  /**
   * Get backups by storage type
   */
  async findByStorage(storage: string): Promise<BackupFileRecord[]> {
    return this.query().where("storage", storage);
  }

  /**
   * Get total size of all active backups
   */
  async getTotalSize(): Promise<number> {
    const result = await this.query()
      .whereNull("deleted_at")
      .sum("file_size as total")
      .first();
    return Number((result as any)?.total || 0);
  }

  /**
   * Get latest backup
   */
  async getLatest(): Promise<BackupFileRecord | undefined> {
    return this.query()
      .whereNull("deleted_at")
      .orderBy("uploaded_at", "desc")
      .first();
  }

  /**
   * Create backup file record
   */
  async createBackup(data: CreateBackupFileData): Promise<BackupFileRecord> {
    await this.query().insert(data);
    return this.findById(data.id) as Promise<BackupFileRecord>;
  }
}

export const BackupFile = new BackupFileModel();
export default BackupFile;
