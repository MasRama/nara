/**
 * Get CSRF token from cookie
 * Used for protecting state-changing requests (POST, PUT, DELETE)
 *
 * @returns CSRF token string or undefined if not found
 *
 * @example
 * const token = getCSRFToken();
 * fetch('/api/data', {
 *   method: 'POST',
 *   headers: {
 *     'X-CSRF-Token': token || '',
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify(data),
 * });
 */
export function getCSRFToken(): string | undefined {
  return document.cookie.match(/csrf_token=([^;]+)/)?.[1];
}

/**
 * Configure axios instance with CSRF token
 * Call this once at app initialization to automatically include CSRF token in all requests
 *
 * @param axiosInstance - Axios instance to configure
 *
 * @example
 * import axios from 'axios';
 * import { configureAxiosCSRF } from './helper';
 *
 * configureAxiosCSRF(axios);
 */
export function configureAxiosCSRF(axiosInstance: { interceptors: { request: { use: (fn: (config: any) => any) => void } } }): void {
  axiosInstance.interceptors.request.use((config: any) => {
    const token = getCSRFToken();
    if (token && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = token;
    }
    return config;
  });
}

/**
 * API response type
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: Record<string, string[]>;
}

/**
 * API options type
 */
interface ApiOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

/**
 * Generates a random password with a mix of letters, numbers and special characters
 */
export function password_generator(pLength: number): string {
  const keyListAlpha = "abcdefghijklmnopqrstuvwxyz";
  const keyListInt = "123456789";
  const keyListSpec = "!@#_";
  let password = '';
  let len = Math.ceil(pLength / 2);
  len = len - 1;
  const lenSpec = pLength - 2 * len;

  for (let i = 0; i < len; i++) {
    password += keyListAlpha.charAt(Math.floor(Math.random() * keyListAlpha.length));
    password += keyListInt.charAt(Math.floor(Math.random() * keyListInt.length));
  }

  for (let i = 0; i < lenSpec; i++) {
    password += keyListSpec.charAt(Math.floor(Math.random() * keyListSpec.length));
  }

  password = password.split('').sort(() => 0.5 - Math.random()).join('');

  return password;
}

/**
 * Creates a debounced version of a function that delays its execution
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  timeout: number = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func(...args);
    }, timeout);
  };
}

/**
 * Format validation errors object into a readable string
 */
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

/**
 * Map HTTP status codes to human-readable messages
 */
function getHttpErrorMessage(status: number, statusText?: string): string {
  const messages: Record<number, string> = {
    400: 'Invalid request. Please check your input.',
    401: 'Please log in to continue.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    405: 'This action is not allowed.',
    408: 'Request timed out. Please try again.',
    409: 'This action conflicts with existing data.',
    413: 'File too large. Please upload a smaller file.',
    422: 'Invalid data provided. Please check your input.',
    429: 'Too many requests. Please wait a moment.',
    500: 'Server error. Please try again later.',
    502: 'Server is temporarily unavailable.',
    503: 'Service unavailable. Please try again later.',
    504: 'Server took too long to respond.',
  };
  return messages[status] || statusText || `Error ${status}`;
}

/**
 * Parse error from various response types
 */
function parseErrorResponse(error: unknown): { message: string; code?: string; errors?: Record<string, string[]> } {
  const axiosError = error as {
    response?: { status?: number; statusText?: string; data?: ApiResponse | string };
    message?: string;
    code?: string;
  };

  // Network error (no response)
  if (!axiosError.response) {
    if (axiosError.code === 'ERR_NETWORK') {
      return { message: 'Unable to connect to server. Please check your connection.' };
    }
    if (axiosError.code === 'ECONNABORTED') {
      return { message: 'Request timed out. Please try again.' };
    }
    return { message: axiosError.message || 'Network error. Please try again.' };
  }

  const { status, statusText, data } = axiosError.response;

  // If response is a string (HTML error page), use status code message
  if (typeof data === 'string') {
    return { message: getHttpErrorMessage(status || 500, statusText) };
  }

  // If response is JSON with our API format
  if (data && typeof data === 'object') {
    const apiResponse = data as ApiResponse;
    if (apiResponse.message) {
      return {
        message: apiResponse.message,
        code: apiResponse.code,
        errors: apiResponse.errors
      };
    }
  }

  // Fallback to HTTP status message
  return { message: getHttpErrorMessage(status || 500, statusText) };
}

/**
 * Standardized API call wrapper that handles JSON responses from backend
 */
export async function api<T = unknown>(
  axiosCall: () => Promise<{ data: ApiResponse<T> }>,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { showSuccessToast = true, showErrorToast = true } = options;

  try {
    const response = await axiosCall();
    const result = response.data;

    if (result.success) {
      if (showSuccessToast && result.message) {
        Toast(result.message, 'success');
      }
      return { success: true, message: result.message, data: result.data };
    } else {
      if (showErrorToast) {
        const errorMsg = result.errors
          ? formatValidationErrors(result.errors) || result.message
          : result.message;
        if (errorMsg) Toast(errorMsg, 'error');
      }
      return { success: false, message: result.message, code: result.code, errors: result.errors };
    }
  } catch (error: unknown) {
    const parsed = parseErrorResponse(error);

    if (showErrorToast) {
      const errorMsg = parsed.errors
        ? formatValidationErrors(parsed.errors) || parsed.message
        : parsed.message;
      Toast(errorMsg, 'error');
    }

    return { success: false, message: parsed.message, code: parsed.code, errors: parsed.errors };
  }
}

type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Displays a toast notification message
 */
export function Toast(text: string, type: ToastType = "success", duration: number = 3000): void {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        `;
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        min-width: 300px;
        max-width: 90vw;
        margin: 0;
        padding: 12px 16px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        transition: all 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 12px;
        backdrop-filter: blur(8px);
    `;

    // Define icons for different types with refined styling
    const icons: Record<ToastType, string> = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        error: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        info: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    // Set background color based on type with refined colors
    let iconType: ToastType = type;
    switch(type) {
        case 'success':
            toast.style.backgroundColor = 'rgba(34, 197, 94, 0.95)';
            break;
        case 'error':
            toast.style.backgroundColor = 'rgba(239, 68, 68, 0.95)';
            break;
        case 'warning':
            toast.style.backgroundColor = 'rgba(245, 158, 11, 0.95)';
            break;
        default:
            toast.style.backgroundColor = 'rgba(59, 130, 246, 0.95)';
            iconType = 'info';
    }

    // Add icon and text with improved styling
    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    `;
    iconWrapper.innerHTML = icons[iconType];

    const textWrapper = document.createElement('div');
    textWrapper.style.cssText = `
        flex-grow: 1;
        line-height: 1.4;
    `;
    textWrapper.textContent = text;

    toast.appendChild(iconWrapper);
    toast.appendChild(textWrapper);
    container.appendChild(toast);

    // Enhanced animation
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0) scale(1)';
    });

    // Remove toast after duration with smooth exit animation
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px) scale(0.95)';
        setTimeout(() => {
            container.removeChild(toast);
            if (container.children.length === 0) {
                document.body.removeChild(container);
            }
        }, 200);
    }, duration);
}

/**
 * Vue directive for click outside detection
 * Usage: v-click-outside="handleClickOutside"
 *
 * @example
 * <div v-click-outside="closeDropdown">...</div>
 */
interface ClickOutsideHTMLElement extends HTMLElement {
  _clickOutsideHandler?: (event: MouseEvent) => void;
}

export const vClickOutside = {
  mounted(el: ClickOutsideHTMLElement, binding: { value: () => void }) {
    el._clickOutsideHandler = (event: MouseEvent) => {
      if (!el.contains(event.target as Node) && !event.defaultPrevented) {
        binding.value();
      }
    };
    document.addEventListener('click', el._clickOutsideHandler, true);
  },
  unmounted(el: ClickOutsideHTMLElement) {
    if (el._clickOutsideHandler) {
      document.removeEventListener('click', el._clickOutsideHandler, true);
    }
  }
};
