/**
 * Factory Base Class
 *
 * Provides a fluent API for creating model instances with fake data.
 * Inspired by Laravel and AdonisJS factories.
 */
import { faker, Faker } from "@faker-js/faker";
import { BaseModel, BaseRecord } from "@models/BaseModel";

/**
 * Factory definition function type
 */
export type FactoryDefinition<T extends BaseRecord> = (faker: Faker) => Partial<T>;

/**
 * State transformation function type
 */
export type StateTransformation<T extends BaseRecord> = (data: Partial<T>) => Partial<T>;

/**
 * Factory class for creating model instances with fake data
 */
export class Factory<T extends BaseRecord> {
  private model: BaseModel<T>;
  private definition: FactoryDefinition<T>;
  private states: Map<string, StateTransformation<T>> = new Map();
  private activeStates: string[] = [];
  private createCount: number = 1;
  private mergeData: Partial<T> = {};

  /**
   * Create a new factory instance
   */
  constructor(model: BaseModel<T>, definition: FactoryDefinition<T>) {
    this.model = model;
    this.definition = definition;
  }

  /**
   * Define a new factory
   */
  static define<T extends BaseRecord>(
    model: BaseModel<T>,
    definition: FactoryDefinition<T>
  ): Factory<T> {
    return new Factory(model, definition);
  }

  /**
   * Register a named state transformation
   */
  state(name: string, transformation: StateTransformation<T>): this {
    this.states.set(name, transformation);
    return this;
  }

  /**
   * Apply a registered state to the factory
   */
  applyState(name: string): this {
    if (!this.states.has(name)) {
      throw new Error(`State '${name}' is not registered. Use state() to register it first.`);
    }
    this.activeStates.push(name);
    return this;
  }

  /**
   * Set the number of records to create
   */
  count(n: number): this {
    this.createCount = n;
    return this;
  }

  /**
   * Merge additional data into the factory output
   */
  merge(data: Partial<T>): this {
    this.mergeData = { ...this.mergeData, ...data };
    return this;
  }

  /**
   * Generate raw data without creating database records
   */
  raw(): Partial<T>;
  raw(): Partial<T>[];
  raw(): Partial<T> | Partial<T>[] {
    const results: Partial<T>[] = [];

    for (let i = 0; i < this.createCount; i++) {
      // Generate base data from definition
      let data = this.definition(faker);

      // Apply state transformations
      for (const stateName of this.activeStates) {
        const transformation = this.states.get(stateName);
        if (transformation) {
          data = transformation(data);
        }
      }

      // Merge additional data
      data = { ...data, ...this.mergeData };

      results.push(data);
    }

    // Reset for next use
    this.reset();

    return this.createCount === 1 ? results[0] : results;
  }

  /**
   * Create model instances without saving to database
   */
  make(): T;
  make(): T[];
  make(): T | T[] {
    const rawData = this.raw();

    if (Array.isArray(rawData)) {
      return rawData.map(data => this.hydrate(data));
    }

    return this.hydrate(rawData);
  }

  /**
   * Create and save records to the database
   */
  async create(): Promise<T>;
  async create(): Promise<T[]>;
  async create(): Promise<T | T[]> {
    const rawData = this.raw();

    if (Array.isArray(rawData)) {
      const records: T[] = [];
      for (const data of rawData) {
        const record = await this.model.create(data as Partial<Omit<T, 'created_at' | 'updated_at'>> & { id: string | number });
        records.push(record);
      }
      return records;
    }

    return this.model.create(rawData as Partial<Omit<T, 'created_at' | 'updated_at'>> & { id: string | number });
  }

  /**
   * Create records and return as plain objects
   */
  async createMany(): Promise<T[]> {
    const result = await this.create();
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Hydrate raw data into a model-like object
   */
  private hydrate(data: Partial<T>): T {
    // Return as-is since we're working with plain objects from the database
    return data as T;
  }

  /**
   * Reset factory state for reuse
   */
  private reset(): void {
    this.activeStates = [];
    this.createCount = 1;
    this.mergeData = {};
  }
}

/**
 * Helper function to create a factory quickly
 */
export function factory<T extends BaseRecord>(
  model: BaseModel<T>,
  definition: FactoryDefinition<T>
): Factory<T> {
  return Factory.define(model, definition);
}

export default Factory;
