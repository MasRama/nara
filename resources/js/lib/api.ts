import { Toast } from '$lib/toast';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: Record<string, string[]>;
}

interface ApiOptions {
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
    const axiosError = error as { response?: { data?: ApiResponse } };
    const message = axiosError?.response?.data?.message || 'Terjadi kesalahan, coba lagi';
    const code = axiosError?.response?.data?.code;
    const errors = axiosError?.response?.data?.errors;

    if (showErrorToast) {
      const errorMsg = errors
        ? formatValidationErrors(errors) || message
        : message;
      Toast(errorMsg, 'error');
    }

    return { success: false, message, code, errors };
  }
}
