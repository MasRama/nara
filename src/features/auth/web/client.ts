import { hc } from 'hono/client';
import type { AuthError, AuthSuccess, ChangePasswordInput, ChangePasswordResponse, CurrentUserResponse, LoginInput, LoginResponse, RegisterInput, RegisterResponse } from '../contract';
import type { authRoutes } from '..';
import { apiFetch } from './csrf';

export interface AuthClient {
  register(input: RegisterInput): Promise<RegisterResponse>;
  login(input: LoginInput): Promise<LoginResponse>;
  changePassword(input: ChangePasswordInput): Promise<ChangePasswordResponse>;
  me(): Promise<CurrentUserResponse>;
  logout(): Promise<AuthSuccess | AuthError>;
}

export function createAuthClient(baseUrl = '/api/auth'): AuthClient {
  const api = hc<typeof authRoutes>(baseUrl.replace(/\/$/, ''), { fetch: apiFetch });

  return {
    register: async (input) => (await api.register.$post({ json: input })).json(),
    login: async (input) => (await api.login.$post({ json: input })).json(),
    changePassword: async (input) => (await api['change-password'].$post({ json: input })).json(),
    me: async () => (await api.me.$get()).json(),
    logout: async () => (await api.logout.$post()).json(),
  };
}
