import { hc } from 'hono/client';
import type {
  AvatarUploadResponse,
  CreateUserInput,
  DeleteUsersInput,
  DeleteUsersResponse,
  EditingResponse,
  ManagedUserResponse,
  ProfileInput,
  ResetUserPasswordInput,
  UpdateProfileResponse,
  UpdateUserInput,
  UpdateUserResponse,
  UserProfileResponse,
  UsersEditingResponse,
  UsersResponse,
} from '../contract';
import type { createAssetRoutes, createUserRoutes } from '..';
import type { UsersWebCsrf } from './host';

export interface UsersClient {
  me(): Promise<UserProfileResponse>;
  updateProfile(input: ProfileInput): Promise<UpdateProfileResponse>;
  listUsers(input?: { page?: number; limit?: number; search?: string }): Promise<UsersResponse>;
  createUser(input: CreateUserInput): Promise<ManagedUserResponse>;
  updateUser(id: string, input: UpdateUserInput): Promise<UpdateUserResponse>;
  resetPassword(id: string, input: ResetUserPasswordInput): Promise<ManagedUserResponse>;
  deleteUsers(input: DeleteUsersInput): Promise<DeleteUsersResponse>;
  uploadAvatar(file: File): Promise<AvatarUploadResponse>;
  listEditing(): Promise<UsersEditingResponse>;
  startEditing(id: string): Promise<EditingResponse>;
  stopEditing(id: string): Promise<EditingResponse>;
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

  /** Same-origin `fetch` carrying the session cookie and, on writes, the host's CSRF token. */
  const apiFetch: typeof fetch = async (input, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') await csrf?.ensureToken();
    return fetch(input, { ...init, credentials: 'include', headers: csrf ? csrf.headers(init.headers) : init.headers });
  };
  const users = hc<ReturnType<typeof createUserRoutes>>(baseUrl.replace(/\/$/, ''), { fetch: apiFetch });
  const assets = hc<ReturnType<typeof createAssetRoutes>>(assetsBaseUrl.replace(/\/$/, ''), { fetch: apiFetch });

  return {
    me: async () => (await users.me.$get()).json(),
    updateProfile: async (input) => (await users.me.$patch({ json: input })).json(),
    listUsers: async ({ page = 1, limit = 10, search = '' } = {}) =>
      (await users.index.$get({ query: { page: String(page), limit: String(limit), search } })).json(),
    createUser: async (input) => (await users.index.$post({ json: input })).json(),
    updateUser: async (id, input) => (await users[':id'].$put({ param: { id }, json: input })).json(),
    resetPassword: async (id, input) => (await users[':id']['reset-password'].$post({ param: { id }, json: input })).json(),
    deleteUsers: async (input) => (await users.index.$delete({ json: input })).json(),
    uploadAvatar: async (file) => (await assets.avatar.$post({ form: { file } })).json(),
    listEditing: async () => (await users.editing.$get()).json(),
    startEditing: async (id) => (await users[':id'].editing.$put({ param: { id } })).json(),
    stopEditing: async (id) => (await users[':id'].editing.$delete({ param: { id } })).json(),
  };
}
