import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeEdit } from '../editing';
import { createPresence } from '../presence';

describe('three-way form merge', () => {
  const base = { name: 'Editors', slug: 'editors', description: '', permissions: ['posts.view', 'posts.edit'] };

  it('takes fields only the other side changed and keeps fields only you changed', () => {
    const mine = { ...base, description: 'Mine' };
    const theirs = { ...base, slug: 'content-editors' };
    expect(mergeEdit(base, mine, theirs)).toEqual({
      merged: { ...base, description: 'Mine', slug: 'content-editors' },
      conflicts: [],
      adopted: ['slug'],
    });
  });

  it('reports a field both sides changed differently and keeps yours in it', () => {
    const result = mergeEdit(base, { ...base, name: 'Mine' }, { ...base, name: 'Theirs' });
    expect(result.conflicts).toEqual(['name']);
    expect(result.merged.name).toBe('Mine');
    expect(result.adopted).toEqual([]);
  });

  it('treats the same change on both sides as agreement', () => {
    expect(mergeEdit(base, { ...base, name: 'Same' }, { ...base, name: 'Same' })).toEqual({
      merged: { ...base, name: 'Same' },
      conflicts: [],
      adopted: [],
    });
  });

  it('combines additions and removals from both sides of a set field', () => {
    const mine = { ...base, permissions: ['posts.view', 'posts.edit', 'posts.delete'] };
    const theirs = { ...base, permissions: ['posts.view', 'users.view'] };
    const result = mergeEdit(base, mine, theirs);
    expect(result.conflicts).toEqual([]);
    expect(result.adopted).toEqual(['permissions']);
    expect([...result.merged.permissions].sort()).toEqual(['posts.delete', 'posts.view', 'users.view']);
  });

  it('compares set fields regardless of order', () => {
    const reordered = { ...base, permissions: ['posts.edit', 'posts.view'] };
    expect(mergeEdit(base, base, reordered)).toEqual({ merged: base, conflicts: [], adopted: [] });
  });
});

describe('editing presence', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists one entry per account per key and announces only real changes', () => {
    const onChange = vi.fn();
    const presence = createPresence({ onChange });

    presence.enter('role-1', { id: 'ada', name: 'Ada' });
    presence.enter('role-1', { id: 'ada', name: 'Ada' });
    presence.enter('role-1', { id: 'lin', name: 'Lin' });
    expect(presence.editors()).toEqual({ 'role-1': [{ id: 'ada', name: 'Ada' }, { id: 'lin', name: 'Lin' }] });
    expect(onChange).toHaveBeenCalledTimes(2);

    presence.leave('role-1', 'ada');
    presence.leave('role-1', 'ada');
    presence.leave('role-1', 'lin');
    expect(presence.editors()).toEqual({});
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('drops an entry that was not renewed and announces it', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const presence = createPresence({ onChange, ttlMs: 3_000 });
    presence.enter('user-1', { id: 'ada', name: 'Ada' });
    presence.enter('user-2', { id: 'lin', name: 'Lin' });

    vi.advanceTimersByTime(2_000);
    presence.enter('user-2', { id: 'lin', name: 'Lin' });
    vi.advanceTimersByTime(2_000);

    expect(presence.editors()).toEqual({ 'user-2': [{ id: 'lin', name: 'Lin' }] });
    expect(onChange).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(4_000);
    expect(presence.editors()).toEqual({});
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores new keys beyond its bound', () => {
    const presence = createPresence({ onChange: () => undefined, maxKeys: 1 });
    presence.enter('role-1', { id: 'ada', name: 'Ada' });
    presence.enter('role-2', { id: 'ada', name: 'Ada' });
    presence.enter('role-1', { id: 'lin', name: 'Lin' });
    expect(Object.keys(presence.editors())).toEqual(['role-1']);
    expect(presence.editors()['role-1']).toHaveLength(2);
  });
});
