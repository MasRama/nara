import { hc } from 'hono/client';
import type {
  AvatarUploadResponse,
  ProfileInput,
  UserProfileResponse,
} from '../contract';
import type { userRoutes } from '..';

async function readResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export interface UsersClient {
  me(): Promise<UserProfileResponse>;
  updateProfile(input: ProfileInput): Promise<UserProfileResponse>;
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
