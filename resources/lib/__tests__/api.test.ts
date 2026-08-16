/**
 * Tests for the api() HTTP wrapper (native fetch)
 *
 * Validates request building (CSRF, JSON/FormData bodies),
 * response parsing, and toast behavior on success/error paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '$lib/api';
import { Toast } from '$lib/toast';

vi.mock('$lib/toast', () => ({ Toast: vi.fn() }));
vi.mock('$lib/csrf', () => ({ getCSRFToken: vi.fn(() => 'csrf-token-123') }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body),
});

describe('api()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('GET sends path with Accept header and no CSRF token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: [1] }));

    const result = await api('/roles/data', { showSuccessToast: false });

    expect(fetchMock).toHaveBeenCalledWith('/roles/data', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      body: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('POST serializes object body and attaches CSRF token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: 'Created' }));

    await api('/roles', { method: 'POST', body: { name: 'Editor' } });

    expect(fetchMock).toHaveBeenCalledWith('/roles', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-token-123',
      },
      body: JSON.stringify({ name: 'Editor' }),
    });
  });

  it('DELETE sends JSON body and CSRF token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: 'Deleted', data: { deleted: 1 } }));

    await api('/roles', { method: 'DELETE', body: { ids: ['r-1'] } });

    expect(fetchMock).toHaveBeenCalledWith('/roles', {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-token-123',
      },
      body: JSON.stringify({ ids: ['r-1'] }),
    });
  });

  it('FormData body passes through without Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: 'Uploaded' }));
    const formData = new FormData();
    formData.append('file', 'blob');

    await api('/assets/avatar', { method: 'POST', body: formData });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(formData);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers['X-CSRF-Token']).toBe('csrf-token-123');
  });

  it('shows success toast with message and returns data', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: 'Saved', data: { id: 1 } }));

    const result = await api('/users', { method: 'POST', body: {} });

    expect(Toast).toHaveBeenCalledWith('Saved', 'success');
    expect(result.success).toBe(true);
  });

  it('respects showSuccessToast: false', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: 'Saved' }));

    await api('/roles/data', { showSuccessToast: false });

    expect(Toast).not.toHaveBeenCalled();
  });

  it('returns error response and toasts message on 4xx', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, message: 'Slug already in use', code: 'DUPLICATE_SLUG' }, 400));

    const result = await api('/roles', { method: 'POST', body: {} });

    expect(result).toEqual({ success: false, message: 'Slug already in use', code: 'DUPLICATE_SLUG', errors: undefined });
    expect(Toast).toHaveBeenCalledWith('Slug already in use', 'error');
  });

  it('formats validation errors into the toast', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: { name: ['Required'], slug: ['Invalid format'] },
    }, 422));

    await api('/roles', { method: 'POST', body: {} });

    expect(Toast).toHaveBeenCalledWith('name: Required; slug: Invalid format', 'error');
  });

  it('returns generic error on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await api('/users', { method: 'POST', body: {} });

    expect(result).toEqual({ success: false, message: 'Something went wrong, please try again' });
    expect(Toast).toHaveBeenCalledWith('Something went wrong, please try again', 'error');
  });

  it('returns generic error when response is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')) });

    const result = await api('/users');

    expect(result.success).toBe(false);
    expect(Toast).toHaveBeenCalledWith('Something went wrong, please try again', 'error');
  });

  it('handles 2xx with success:false defensively', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, message: 'Nope' }, 200));

    const result = await api('/users');

    expect(result.success).toBe(false);
    expect(Toast).toHaveBeenCalledWith('Nope', 'error');
  });

  it('falls back to status message when error body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn().mockRejectedValue(new SyntaxError('bad')) });

    const result = await api('/users', { method: 'POST', body: {} });

    expect(result.message).toBe('Request failed (500)');
  });
});
