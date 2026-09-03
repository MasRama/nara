import type {
  CreateRoleInput,
  DeleteRolesInput,
  DeleteRolesResponse,
  PermissionsResponse,
  RoleResponse,
  RolesResponse,
  UpdateRoleInput,
} from '../contract';

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

export interface AccessClient {
  listRoles(): Promise<RolesResponse>;
  listPermissions(): Promise<PermissionsResponse>;
  createRole(input: CreateRoleInput): Promise<RoleResponse>;
  updateRole(id: string, input: UpdateRoleInput): Promise<RoleResponse>;
  deleteRoles(input: DeleteRolesInput): Promise<DeleteRolesResponse>;
}

export function createAccessClient(baseUrl = '/api/roles'): AccessClient {
  const base = baseUrl.replace(/\/$/, '');

  return {
    listRoles: async () => jsonRequest<RolesResponse>(base, { method: 'GET' }),
    listPermissions: async () => jsonRequest<PermissionsResponse>(`${base}/permissions`, { method: 'GET' }),
    createRole: async (input) =>
      jsonRequest<RoleResponse>(base, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateRole: async (id, input) =>
      jsonRequest<RoleResponse>(`${base}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    deleteRoles: async (input) =>
      jsonRequest<DeleteRolesResponse>(base, {
        method: 'DELETE',
        body: JSON.stringify(input),
      }),
  };
}
