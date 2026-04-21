import { describe, it, expect, vi, beforeEach } from 'vitest';
import { debounce } from '$lib/utils/debounce';

describe('debounce()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('arg1');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('arg1');
  });

  it('collapses multiple rapid calls into one', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    debounced('b');
    debounced('c');

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('uses default timeout of 300ms', () => {
    const fn = vi.fn();
    const debounced = debounce(fn);

    debounced();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('forwards all arguments to the wrapped function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('x', 'y', 'z');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('x', 'y', 'z');
  });
});
