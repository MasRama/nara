import { describe, it, expect, vi } from 'vitest';
import { Toast } from '$lib/toast';

vi.mock('svelte-sonner', () => ({
  toast: Object.assign(
    vi.fn(),
    {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    }
  ),
}));

import { toast } from 'svelte-sonner';

describe('Toast()', () => {
  it('calls toast.success for success type', () => {
    Toast('All good', 'success');
    expect(toast.success).toHaveBeenCalledWith('All good');
  });

  it('calls toast.error for error type', () => {
    Toast('Something failed', 'error');
    expect(toast.error).toHaveBeenCalledWith('Something failed');
  });

  it('calls toast.warning for warning type', () => {
    Toast('Check this', 'warning');
    expect(toast.warning).toHaveBeenCalledWith('Check this');
  });

  it('calls toast.info for info type', () => {
    Toast('FYI', 'info');
    expect(toast.info).toHaveBeenCalledWith('FYI');
  });

  it('uses success as default type', () => {
    Toast('Default message');
    expect(toast.success).toHaveBeenCalledWith('Default message');
  });

  it('accepts signature (text: string, type: ToastType, duration: number)', () => {
    expect(() => Toast('msg', 'info', 100)).not.toThrow();
  });
});
