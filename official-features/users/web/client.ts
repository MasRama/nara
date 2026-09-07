import type {
  AvatarUploadResponse,
  CreateUserInput,
  DeleteUsersInput,
  DeleteUsersResponse,
  ManagedUserResponse,
  ProfileInput,
  ResetUserPasswordInput,
  UpdateUserInput,
  UserProfileResponse,
  UsersResponse,
} from '../contract';
import type { UsersWebCsrf } from './host';

async function readResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function jsonRequest<T>(url: string, init: RequestInit, csrf?: UsersWebCsrf): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    await csrf?.ensureToken();
  }
  return readResponse<T>(
    await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? csrf.headers(init.headers) : init.headers),
      },
    }),
  );
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export interface UsersClient {
  me(): Promise<UserProfileResponse>;
  updateProfile(input: ProfileInput): Promise<UserProfileResponse>;
  listUsers(input?: { page?: number; limit?: number; search?: string }): Promise<UsersResponse>;
  createUser(input: CreateUserInput): Promise<ManagedUserResponse>;
  updateUser(id: string, input: UpdateUserInput): Promise<ManagedUserResponse>;
  resetPassword(id: string, input: ResetUserPasswordInput): Promise<ManagedUserResponse>;
  deleteUsers(input: DeleteUsersInput): Promise<DeleteUsersResponse>;
  uploadAvatar(file: File): Promise<AvatarUploadResponse>;
}

export interface UsersClientOptions {
  baseUrl?: string;
  assetsBaseUrl?: string;
  /**
   * CSRF provider for state-changing requests. Supplied by the caller —
   * usually the page's `UsersWebHost` from the application binding. Without
   * it, mutations reach the server without a CSRF token and fail closed
   * there instead of masking the missing provider.
   */
  csrf?: UsersWebCsrf;
}

export function createUsersClient(options: UsersClientOptions = {}): UsersClient {
  const { baseUrl = '/api/users', assetsBaseUrl = '/api/assets', csrf } = options;

  return {
    me: async () =>
      jsonRequest<UserProfileResponse>(endpoint(baseUrl, '/me'), { method: 'GET' }, csrf),
    updateProfile: async (input) =>
      jsonRequest<UserProfileResponse>(endpoint(baseUrl, '/me'), {
        method: 'PATCH',
        body: JSON.stringify(input),
      }, csrf),
    listUsers: async ({ page = 1, limit = 10, search = '' } = {}) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
      });
      return jsonRequest<UsersResponse>(`${baseUrl.replace(/\/$/, '')}?${params.toString()}`, { method: 'GET' }, csrf);
    },
    createUser: async (input) =>
      jsonRequest<ManagedUserResponse>(baseUrl.replace(/\/$/, ''), {
        method: 'POST',
        body: JSON.stringify(input),
      }, csrf),
    updateUser: async (id, input) =>
      jsonRequest<ManagedUserResponse>(`${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }, csrf),
    resetPassword: async (id, input) =>
      jsonRequest<ManagedUserResponse>(`${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(id)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(input),
      }, csrf),
    deleteUsers: async (input) =>
      jsonRequest<DeleteUsersResponse>(baseUrl.replace(/\/$/, ''), {
        method: 'DELETE',
        body: JSON.stringify(input),
      }, csrf),
    uploadAvatar: async (file) => {
      const form = new FormData();
      form.set('file', file);
      await csrf?.ensureToken();
      return readResponse<AvatarUploadResponse>(
        await fetch(endpoint(assetsBaseUrl, '/avatar'), {
          method: 'POST',
          credentials: 'include',
          headers: csrf ? csrf.headers() : {},
          body: form,
        }),
      );
    },
  };
}
