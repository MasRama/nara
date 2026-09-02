import { hc } from 'hono/client';
import type { AuthError, AuthSuccess, ChangePasswordInput, ChangePasswordResponse, CurrentUserResponse, LoginInput, LoginResponse, RegisterInput, RegisterResponse } from '../contract';
import type { authRoutes } from '..';

async function readResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export interface AuthClient {
  register(input: RegisterInput): Promise<RegisterResponse>;
  login(input: LoginInput): Promise<LoginResponse>;
  changePassword(input: ChangePasswordInput): Promise<ChangePasswordResponse>;
  me(): Promise<CurrentUserResponse>;
  logout(): Promise<AuthSuccess | AuthError>;
}

export function createAuthClient(baseUrl = ''): AuthClient {
  const client = hc<typeof authRoutes>(baseUrl, { init: { credentials: 'include' } });

  return {
    register: async (input) => readResponse<RegisterResponse>(await client.register.$post({ json: input })),
    login: async (input) => readResponse<LoginResponse>(await client.login.$post({ json: input })),
    changePassword: async (input) => readResponse<ChangePasswordResponse>(await client['change-password'].$post({ json: input })),
    me: async () => readResponse<CurrentUserResponse>(await client.me.$get()),
    logout: async () => readResponse<AuthSuccess | AuthError>(await client.logout.$post({})),
  };
}
