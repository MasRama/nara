import { hc } from 'hono/client';
import type {
  AvatarUploadResponse,
  CreateUserInput,
  DeleteUsersInput,
  DeleteUsersResponse,
  ManagedUserResponse,
  ProfileInput,
  UpdateUserInput,
  UserProfileResponse,
  UsersResponse,
} from '../contract';
import type { userRoutes } from '..';

async function readResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  return readResponse<T>(
    await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
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
  deleteUsers(input: DeleteUsersInput): Promise<DeleteUsersResponse>;
  uploadAvatar(file: File): Promise<AvatarUploadResponse>;
}

export function createUsersClient(
  baseUrl = '/api/users',
  assetsBaseUrl = '/api/assets',
): UsersClient {
  const client = hc<typeof userRoutes>(baseUrl, { init: { credentials: 'include' } });

  return {
    me: async () => readResponse<UserProfileResponse>(await client.me.$get()),
    updateProfile: async (input) =>
      readResponse<UserProfileResponse>(await client.me.$patch({ json: input })),
    listUsers: async ({ page = 1, limit = 10, search = '' } = {}) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
      });
      return jsonRequest<UsersResponse>(`${baseUrl.replace(/\/$/, '')}?${params.toString()}`, { method: 'GET' });
    },
    createUser: async (input) =>
      jsonRequest<ManagedUserResponse>(baseUrl.replace(/\/$/, ''), {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateUser: async (id, input) =>
      jsonRequest<ManagedUserResponse>(`${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    deleteUsers: async (input) =>
      jsonRequest<DeleteUsersResponse>(baseUrl.replace(/\/$/, ''), {
        method: 'DELETE',
        body: JSON.stringify(input),
      }),
    uploadAvatar: async (file) => {
      const form = new FormData();
      form.set('file', file);
      return readResponse<AvatarUploadResponse>(
        await fetch(endpoint(assetsBaseUrl, '/avatar'), {
          method: 'POST',
          credentials: 'include',
          body: form,
        }),
      );
    },
  };
}
