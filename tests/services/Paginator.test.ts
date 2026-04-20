import { describe, it, expect } from 'vitest';
import { parsePaginationQuery } from '../../app/services/Paginator';

describe('parsePaginationQuery', () => {
  it('returns defaults when query is empty', () => {
    const result = parsePaginationQuery({});
    expect(result.page).toBe(1);
    expect(result.limit).toBeGreaterThan(0);
  });

  it('parses page and limit from query string values', () => {
    const result = parsePaginationQuery({ page: '2', limit: '20' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
  });

  it('clamps page to minimum of 1', () => {
    const result = parsePaginationQuery({ page: '0' });
    expect(result.page).toBe(1);

    const negative = parsePaginationQuery({ page: '-5' });
    expect(negative.page).toBe(1);
  });

  it('falls back to default when limit is 0', () => {
    const result = parsePaginationQuery({ limit: '0' });
    expect(result.limit).toBeGreaterThan(0);
  });

  it('clamps limit to max page size', () => {
    const result = parsePaginationQuery({ limit: '99999' });
    expect(result.limit).toBeLessThanOrEqual(200);
  });

  it('handles non-numeric strings gracefully', () => {
    const result = parsePaginationQuery({ page: 'abc', limit: 'xyz' });
    expect(result.page).toBe(1);
    expect(result.limit).toBeGreaterThan(0);
  });
});
