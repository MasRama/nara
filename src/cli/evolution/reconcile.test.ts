import { describe, expect, it } from 'vitest';
import { reconcileFeatureFiles, type FeatureReconciliation } from './reconcile';

function files(entries: Record<string, string | Uint8Array> = {}): Map<string, Buffer> {
  return new Map(Object.entries(entries).map(([relativePath, content]) => [relativePath, Buffer.from(content)]));
}

function action(result: FeatureReconciliation, relativePath: string): string {
  return result.files.find((file) => file.path === relativePath)?.action ?? 'missing';
}

describe('Feature source reconciliation', () => {
  it('leaves unchanged files unchanged', () => {
    const result = reconcileFeatureFiles(files({ 'index.ts': 'same\n' }), files({ 'index.ts': 'same\n' }), files({ 'index.ts': 'same\n' }));

    expect(action(result, 'index.ts')).toBe('unchanged');
    expect(result.conflicts).toEqual([]);
    expect(result.candidate.get('index.ts')?.toString()).toBe('same\n');
  });

  it('updates a file changed only upstream', () => {
    const result = reconcileFeatureFiles(files({ 'index.ts': 'base\n' }), files({ 'index.ts': 'base\n' }), files({ 'index.ts': 'incoming\n' }));

    expect(action(result, 'index.ts')).toBe('update');
    expect(result.candidate.get('index.ts')?.toString()).toBe('incoming\n');
  });

  it('keeps a file changed only locally', () => {
    const result = reconcileFeatureFiles(files({ 'index.ts': 'base\n' }), files({ 'index.ts': 'local\n' }), files({ 'index.ts': 'base\n' }));

    expect(action(result, 'index.ts')).toBe('keep-local');
    expect(result.candidate.get('index.ts')?.toString()).toBe('local\n');
  });

  it('recognizes an identical local and upstream modification', () => {
    const result = reconcileFeatureFiles(files({ 'index.ts': 'base\n' }), files({ 'index.ts': 'changed\n' }), files({ 'index.ts': 'changed\n' }));

    expect(action(result, 'index.ts')).toBe('unchanged');
    expect(result.conflicts).toEqual([]);
  });

  it('adds an upstream-only file', () => {
    const result = reconcileFeatureFiles(files(), files(), files({ 'new.ts': 'incoming\n' }));

    expect(action(result, 'new.ts')).toBe('add');
    expect(result.candidate.get('new.ts')?.toString()).toBe('incoming\n');
  });

  it('keeps a local-only file', () => {
    const result = reconcileFeatureFiles(files(), files({ 'local.ts': 'local\n' }), files());

    expect(action(result, 'local.ts')).toBe('keep-local');
    expect(result.candidate.get('local.ts')?.toString()).toBe('local\n');
  });

  it('removes a file deleted only upstream', () => {
    const result = reconcileFeatureFiles(files({ 'old.ts': 'base\n' }), files({ 'old.ts': 'base\n' }), files());

    expect(action(result, 'old.ts')).toBe('remove');
    expect(result.candidate.has('old.ts')).toBe(false);
  });

  it('keeps a local deletion when upstream is unchanged', () => {
    const result = reconcileFeatureFiles(files({ 'old.ts': 'base\n' }), files(), files({ 'old.ts': 'base\n' }));

    expect(action(result, 'old.ts')).toBe('keep-local');
    expect(result.candidate.has('old.ts')).toBe(false);
  });

  it('merges non-overlapping text changes', () => {
    const result = reconcileFeatureFiles(
      files({ 'index.ts': 'one\nbase\nthree\n' }),
      files({ 'index.ts': 'local\nbase\nthree\n' }),
      files({ 'index.ts': 'one\nbase\nincoming\n' }),
    );

    expect(action(result, 'index.ts')).toBe('merge');
    expect(result.conflicts).toEqual([]);
    expect(result.candidate.get('index.ts')?.toString()).toBe('local\nbase\nincoming\n');
  });

  it('reports overlapping text changes as conflicts', () => {
    const result = reconcileFeatureFiles(
      files({ 'index.ts': 'one\nbase\nthree\n' }),
      files({ 'index.ts': 'one\nlocal\nthree\n' }),
      files({ 'index.ts': 'one\nincoming\nthree\n' }),
    );

    expect(action(result, 'index.ts')).toBe('conflict');
    expect(result.conflicts).toEqual(['index.ts']);
    expect(result.candidate.get('index.ts')?.toString()).toBe('one\nlocal\nthree\n');
  });
  it('reports multiple overlapping text regions as one file conflict without throwing', () => {
    const result = reconcileFeatureFiles(
      files({ 'index.ts': 'one\nbase-a\ntwo\nbase-b\nthree\n' }),
      files({ 'index.ts': 'one\nlocal-a\ntwo\nlocal-b\nthree\n' }),
      files({ 'index.ts': 'one\nincoming-a\ntwo\nincoming-b\nthree\n' }),
    );

    expect(action(result, 'index.ts')).toBe('conflict');
    expect(result.conflicts).toEqual(['index.ts']);
    expect(result.candidate.get('index.ts')?.toString()).toBe('one\nlocal-a\ntwo\nlocal-b\nthree\n');
  });


  it('conflicts when local changes meet an upstream deletion', () => {
    const result = reconcileFeatureFiles(files({ 'index.ts': 'base\n' }), files({ 'index.ts': 'local\n' }), files());

    expect(result.conflicts).toEqual(['index.ts']);
    expect(action(result, 'index.ts')).toBe('conflict');
  });

  it('conflicts when local deletion meets an upstream change', () => {
    const result = reconcileFeatureFiles(files({ 'index.ts': 'base\n' }), files(), files({ 'index.ts': 'incoming\n' }));

    expect(result.conflicts).toEqual(['index.ts']);
    expect(action(result, 'index.ts')).toBe('conflict');
  });

  it('accepts an identical binary modification from both sides', () => {
    const result = reconcileFeatureFiles(
      new Map([['asset.bin', Buffer.from([0, 1, 2])]]),
      new Map([['asset.bin', Buffer.from([0, 1, 3])]]),
      new Map([['asset.bin', Buffer.from([0, 1, 3])]]),
    );

    expect(action(result, 'asset.bin')).toBe('unchanged');
    expect(result.conflicts).toEqual([]);
  });

  it('keeps a binary one-side local modification', () => {
    const result = reconcileFeatureFiles(
      new Map([['asset.bin', Buffer.from([0, 1, 2])]]),
      new Map([['asset.bin', Buffer.from([0, 1, 3])]]),
      new Map([['asset.bin', Buffer.from([0, 1, 2])]]),
    );

    expect(action(result, 'asset.bin')).toBe('keep-local');
    expect(result.candidate.get('asset.bin')).toEqual(Buffer.from([0, 1, 3]));
  });

  it('conflicts on independent binary modifications', () => {
    const result = reconcileFeatureFiles(
      new Map([['asset.bin', Buffer.from([0, 1, 2])]]),
      new Map([['asset.bin', Buffer.from([0, 1, 3])]]),
      new Map([['asset.bin', Buffer.from([0, 1, 4])]]),
    );

    expect(action(result, 'asset.bin')).toBe('conflict');
    expect(result.conflicts).toEqual(['asset.bin']);
  });

  it('orders the plan by relative POSIX path', () => {
    const result = reconcileFeatureFiles(
      files({ 'z.ts': 'base', 'a.ts': 'base' }),
      files({ 'z.ts': 'local', 'a.ts': 'base' }),
      files({ 'z.ts': 'base', 'a.ts': 'incoming' }),
    );

    expect(result.files.map((file) => file.path)).toEqual(['a.ts', 'z.ts']);
  });
});
