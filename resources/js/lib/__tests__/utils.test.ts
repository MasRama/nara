import { describe, it, expect } from 'vitest';
import { cn } from '$lib/utils';

describe('cn()', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deduplicates Tailwind conflicts (last one wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles object class values', () => {
    expect(cn({ 'foo': true, 'bar': false })).toBe('foo');
  });

  it('handles array class values', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', undefined, null, false, '')).toBe('foo');
  });

  it('handles mixed inputs', () => {
    expect(cn('foo', { 'bar': true }, ['baz'])).toBe('foo bar baz');
  });
});
