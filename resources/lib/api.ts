import { getCSRFToken } from '$lib/csrf';
import { Toast } from '$lib/toast';
import type { ApiResponse } from '../types';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

function formatValidationErrors(errors: Record<string, string[]> | undefined): string {
  if (!errors || typeof errors !== 'object') return '';

  const messages: string[] = [];
  for (const [field, fieldErrors] of Object.entries(errors)) {
    if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
      messages.push(`${field}: ${fieldErrors[0]}`);
    }
  }
  return messages.join('; ');
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, showSuccessToast = true, showErrorToast = true } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: BodyInit | undefined;

  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body; // browser sets multipart boundary
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  // Double-submit cookie CSRF — server validates X-CSRF-Token against csrf_token cookie
  if (method !== 'GET') {
    const token = getCSRFToken();
    if (token) headers['X-CSRF-Token'] = token;
  }

  let response: Response;
  try {
    response = await fetch(path, { method, headers, body: payload });
  } catch {
    if (showErrorToast) Toast('Something went wrong, please try again', 'error');
    return { success: false, message: 'Something went wrong, please try again' };
  }

  let result: ApiResponse<T> | null = null;
  try {
    result = (await response.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON body (e.g. redirect) — generic error below
  }

  if (!response.ok) {
    const message = result?.message || `Request failed (${response.status})`;
    const code = result && !result.success ? result.code : undefined;
    const errors = result && !result.success ? result.errors : undefined;

    if (showErrorToast) {
      const errorMsg = errors ? formatValidationErrors(errors) || message : message;
      Toast(errorMsg, 'error');
    }
    return { success: false, message, code, errors };
  }

  if (!result) {
    if (showErrorToast) Toast('Something went wrong, please try again', 'error');
    return { success: false, message: 'Something went wrong, please try again' };
  }

  if (result.success) {
    if (showSuccessToast && result.message) Toast(result.message, 'success');
    return result;
  }

  // 2xx with success:false (defensive — server contract uses non-2xx for errors)
  if (showErrorToast) {
    const errorMsg = formatValidationErrors(result.errors) || result.message;
    if (errorMsg) Toast(errorMsg, 'error');
  }
  return result;
}
