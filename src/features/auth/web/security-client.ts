import type {
  AuthError,
  AuthSuccess,
  ConfirmPasswordInput,
  RecoveryCodesResponse,
  RevokeSessionsResponse,
  SessionsResponse,
  TwoFactorChallengeInput,
  TwoFactorChallengeResponse,
  TwoFactorCodeInput,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
} from '../contract';
import { csrfHeaders, ensureCsrfToken } from './csrf';

async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET') await ensureCsrfToken();
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders(init.headers) },
  });
  return (await response.json()) as T;
}

export interface SecurityClient {
  completeTwoFactor(input: TwoFactorChallengeInput): Promise<TwoFactorChallengeResponse>;
  listSessions(): Promise<SessionsResponse>;
  revokeSession(id: string): Promise<RevokeSessionsResponse>;
  revokeOtherSessions(): Promise<RevokeSessionsResponse>;
  twoFactorStatus(): Promise<TwoFactorStatusResponse>;
  startTwoFactorSetup(input: ConfirmPasswordInput): Promise<TwoFactorSetupResponse>;
  enableTwoFactor(input: TwoFactorCodeInput): Promise<RecoveryCodesResponse>;
  disableTwoFactor(input: ConfirmPasswordInput): Promise<AuthSuccess | AuthError>;
  regenerateRecoveryCodes(input: ConfirmPasswordInput): Promise<RecoveryCodesResponse>;
}

export function createSecurityClient(baseUrl = '/api/auth'): SecurityClient {
  const base = baseUrl.replace(/\/$/, '');
  const post = <T>(path: string, body?: unknown) =>
    jsonRequest<T>(`${base}${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) });

  return {
    completeTwoFactor: (input) => post('/two-factor/challenge', input),
    listSessions: () => jsonRequest(`${base}/sessions`, { method: 'GET' }),
    revokeSession: (id) => jsonRequest(`${base}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    revokeOtherSessions: () => post('/sessions/revoke-others'),
    twoFactorStatus: () => jsonRequest(`${base}/two-factor`, { method: 'GET' }),
    startTwoFactorSetup: (input) => post('/two-factor/setup', input),
    enableTwoFactor: (input) => post('/two-factor/enable', input),
    disableTwoFactor: (input) => post('/two-factor/disable', input),
    regenerateRecoveryCodes: (input) => post('/two-factor/recovery-codes', input),
  };
}
