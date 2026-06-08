import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import SQLite from '../../app/services/SQLite';

describe('SQLite', () => {
  beforeEach(() => {
    SQLite.exec`DROP TABLE IF EXISTS test_users`;
    SQLite.exec`CREATE TABLE test_users (id TEXT PRIMARY KEY, name TEXT, age INTEGER)`;
  });

  afterEach(() => {
    SQLite.exec`DROP TABLE IF EXISTS test_users`;
  });

  it('should insert and retrieve with template literals', () => {
    SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'1'}, ${'Alice'}, ${30})`;
    
    const user = SQLite.one<{ id: string; name: string; age: number }>`
      SELECT * FROM test_users WHERE id = ${'1'}
    `;
    
    expect(user).toEqual({ id: '1', name: 'Alice', age: 30 });
  });

  it('should return undefined for non-existent row', () => {
    const user = SQLite.one`SELECT * FROM test_users WHERE id = ${'999'}`;
    expect(user).toBeUndefined();
  });

  it('should retrieve multiple rows', () => {
    SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'1'}, ${'Alice'}, ${30})`;
    SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'2'}, ${'Bob'}, ${25})`;
    
    const users = SQLite.many<{ id: string; name: string; age: number }>`
      SELECT * FROM test_users ORDER BY age DESC
    `;
    
    expect(users).toHaveLength(2);
    expect(users[0].name).toBe('Alice');
    expect(users[1].name).toBe('Bob');
  });

  it('should handle string params', () => {
    const result = SQLite.run(
      'INSERT INTO test_users (id, name, age) VALUES (?, ?, ?)',
      ['1', 'Alice', 30]
    );
    
    expect(result.changes).toBe(1);
  });

  it('should execute transactions', () => {
    SQLite.transaction(() => {
      SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'1'}, ${'Alice'}, ${30})`;
      SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'2'}, ${'Bob'}, ${25})`;
    });
    
    const count = SQLite.one<{ count: number }>`SELECT COUNT(*) as count FROM test_users`;
    expect(count?.count).toBe(2);
  });

  it('should rollback on transaction error', () => {
    try {
      SQLite.transaction(() => {
        SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'1'}, ${'Alice'}, ${30})`;
        throw new Error('Rollback test');
      });
    } catch {}
    
    const count = SQLite.one<{ count: number }>`SELECT COUNT(*) as count FROM test_users`;
    expect(count?.count).toBe(0);
  });

  it('should handle dynamic SQL with IN clause', () => {
    SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'1'}, ${'Alice'}, ${30})`;
    SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'2'}, ${'Bob'}, ${25})`;
    SQLite.exec`INSERT INTO test_users (id, name, age) VALUES (${'3'}, ${'Charlie'}, ${35})`;
    
    const ids = ['1', '3'];
    const placeholders = ids.map(() => '?').join(',');
    const users = SQLite.all<{ id: string; name: string }>(
      `SELECT id, name FROM test_users WHERE id IN (${placeholders})`,
      ids
    );
    
    expect(users).toHaveLength(2);
    expect(users.map((u: { id: string; name: string }) => u.name)).toEqual(['Alice', 'Charlie']);
  });
});
