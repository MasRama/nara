import { hc } from 'hono/client';
import type {
  CreateRoleInput,
  DeleteRolesInput,
  DeleteRolesResponse,
  PermissionsResponse,
  RoleResponse,
  RolesResponse,
  UpdateRoleInput,
} from '../contract';
import type { createAccessRoutes } from '..';
import { apiFetch } from './csrf';

export interface AccessClient {
  listRoles(): Promise<RolesResponse>;
  listPermissions(): Promise<PermissionsResponse>;
  createRole(input: CreateRoleInput): Promise<RoleResponse>;
  updateRole(id: string, input: UpdateRoleInput): Promise<RoleResponse>;
  deleteRoles(input: DeleteRolesInput): Promise<DeleteRolesResponse>;
}

export function createAccessClient(baseUrl = '/api/roles'): AccessClient {
  const api = hc<ReturnType<typeof createAccessRoutes>>(baseUrl.replace(/\/$/, ''), { fetch: apiFetch });

  return {
    listRoles: async () => (await api.index.$get()).json(),
    listPermissions: async () => (await api.permissions.$get()).json(),
    createRole: async (input) => (await api.index.$post({ json: input })).json(),
    updateRole: async (id, input) => (await api[':id'].$put({ param: { id }, json: input })).json(),
    deleteRoles: async (input) => (await api.index.$delete({ json: input })).json(),
  };
}
