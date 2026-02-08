/**
 * BaseModel
 * 
 * Abstract base class for all models providing common database operations.
 * Uses Knex.js query builder for database interactions.
 */
import DB from "../services/DB.js";
import { Knex } from "knex";
import dayjs from "dayjs";

/**
 * Base interface for all model records
 */
export interface BaseRecord {
  id: string | number;
}

/**
 * Options for timestamp handling
 */
export interface TimestampOptions {
  useTimestamps?: boolean;
  timestampFormat?: 'bigint' | 'datetime';
}

/**
 * Abstract base model class
 */
export abstract class BaseModel<T extends BaseRecord> {
  protected abstract tableName: string;
  protected timestampOptions: TimestampOptions = {
    useTimestamps: true,
    timestampFormat: 'bigint'
  };

  /**
   * Get the base query builder for this model's table
   */
  protected query(): Knex.QueryBuilder {
    return DB.from(this.tableName);
  }

  /**
   * Get current timestamp based on format
   */
  protected getTimestamp(): number | Date {
    if (this.timestampOptions.timestampFormat === 'datetime') {
      return new Date();
    }
    return dayjs().valueOf();
  }

  /**
   * Add timestamps to data object
   */
  protected addCreatedTimestamps<D extends object>(data: D): D & { created_at: number | Date; updated_at: number | Date } {
    const timestamp = this.getTimestamp();
    return {
      ...data,
      created_at: timestamp,
      updated_at: timestamp
    };
  }

  /**
   * Add updated timestamp to data object
   */
  protected addUpdatedTimestamp<D extends object>(data: D): D & { updated_at: number | Date } {
    return {
      ...data,
      updated_at: this.getTimestamp()
    };
  }

  /**
   * Find a record by ID
   */
  async findById(id: string | number): Promise<T | undefined> {
    return this.query().where("id", id).first();
  }

  /**
   * Find a single record by conditions
   */
  async findBy(conditions: Partial<T>): Promise<T | undefined> {
    return this.query().where(conditions).first();
  }

  /**
   * Find all records matching conditions
   */
  async findAllBy(conditions: Partial<T>): Promise<T[]> {
    return this.query().where(conditions);
  }

  /**
   * Get all records
   */
  async all(): Promise<T[]> {
    return this.query();
  }

  /**
   * Create a new record
   */
  async create(data: Partial<Omit<T, 'created_at' | 'updated_at'>> & { id: string | number }): Promise<T> {
    const insertData = this.timestampOptions.useTimestamps 
      ? this.addCreatedTimestamps(data)
      : data;
    
    await DB.table(this.tableName).insert(insertData);
    
    // Return the created record
    const record = await this.findById(data.id);
    return record as T;
  }

  /**
   * Update a record by ID
   */
  async update(id: string | number, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T | undefined> {
    const updateData = this.timestampOptions.useTimestamps
      ? this.addUpdatedTimestamp(data)
      : data;

    await this.query().where("id", id).update(updateData);
    return this.findById(id);
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string | number): Promise<number> {
    return this.query().where("id", id).delete();
  }

  /**
   * Delete records by conditions
   */
  async deleteBy(conditions: Partial<T>): Promise<number> {
    return this.query().where(conditions).delete();
  }

  /**
   * Check if a record exists
   */
  async exists(conditions: Partial<T>): Promise<boolean> {
    const record = await this.findBy(conditions);
    return !!record;
  }

  /**
   * Count records matching conditions
   */
  async count(conditions?: Partial<T>): Promise<number> {
    let query = this.query();
    if (conditions) {
      query = query.where(conditions);
    }
    const result = await query.count('* as count').first();
    return Number((result as any)?.count || 0);
  }
}
