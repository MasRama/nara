import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../shared/database/migrator';
import { digestFeatureFiles, readFeatureFiles } from './lineage';
import { acceptTransition, planTransition } from '../commands/transition';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function track(directory: string): string {
  fixtures.push(directory);
  return directory;
}

function writeText(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function sha256File(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

const CONTRACT_BASE = `import { z } from 'zod';

const displayNameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);

export const profileInputSchema = z.object({ name: displayNameSchema });

export const createUserInputSchema = z.object({
  name: displayNameSchema,
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roles: z.array(z.string()).optional(),
});

export const updateUserInputSchema = z
  .object({
    name: displayNameSchema.optional(),
    email: z.string().trim().email('Invalid email format').optional(),
  })
  .refine((value) => value.name !== undefined || value.email !== undefined, {
    message: 'At least one field is required to update',
  });

export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}
`;

const CONTRACT_LOCAL_EXTRA = `import { z } from 'zod';

export const RESERVED_DISPLAY_NAMES = ['admin', 'support', 'system'];

function displayNameIsAllowed(name: string): boolean {
  return !RESERVED_DISPLAY_NAMES.includes(name.trim().toLowerCase());
}

const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100)
  .refine(displayNameIsAllowed, { message: 'Display name is reserved' });
`;

const CONTRACT_INCOMING_TAIL = `
export interface AvatarRetirement {
  userId: string;
  retiredAt: number;
}
`;

function contractLocal(): string {
  return CONTRACT_BASE.replace(
    `import { z } from 'zod';\n\nconst displayNameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);`,
    CONTRACT_LOCAL_EXTRA.trimEnd(),
  );
}

function contractIncoming(): string {
  return CONTRACT_BASE.replace(
    `export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}`,
    `export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarRetiredAt?: number | null;
}`,
  ).concat(CONTRACT_INCOMING_TAIL);
}

const HOST_BASE = `import type { UserProfile } from '../contract';

export type UsersManageAction = 'view' | 'create' | 'edit' | 'delete';

export interface UsersAccountUpdateInput {
  name?: string;
  email?: string;
}

export interface UsersIdentityHost {
  resolveActor(sessionToken: string | undefined): { id: string; avatar: string | null } | undefined;
  hashPassword(password: string): string;
  findAccountById(userId: string): UserProfile | undefined;
  listAccounts(page: number, limit: number, search?: string): { data: UserProfile[]; total: number };
  createAccount(input: { id: string; name: string; email: string; passwordHash: string }): UserProfile;
  updateAccount(userId: string, patch: UsersAccountUpdateInput): UserProfile | undefined;
  deleteAccounts(userIds: string[]): number;
}

export interface UsersRoleRef {
  id: string;
  slug: string;
}

export interface UsersAuthorizationHost {
  canManageUsers(actorId: string, action: UsersManageAction): boolean;
  canAssignRoles(actorId: string): boolean;
  availableRoles(): UsersRoleRef[];
  rolesForUser(userId: string): string[];
  setUserRoles(userId: string, roleIds: string[]): void;
  usersWithRole(roleId: string): Array<{ id: string }>;
}

export interface UsersServerHost extends UsersIdentityHost, UsersAuthorizationHost {
  readonly sessionCookieName: string;
}
`;

const HOST_INCOMING = HOST_BASE.replace(
  `  canManageUsers(actorId: string, action: UsersManageAction): boolean;
  canAssignRoles(actorId: string): boolean;`,
  `  canManageUsers(actorId: string, action: UsersManageAction): boolean;
  canAssignRoles(actorId: string): boolean;
  canUpdateAccount(actorId: string, targetAccountId: string): boolean;`,
);

function routesSource(updateGuard: string): string {
  return `import { randomUUID } from 'node:crypto';
import { getCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { createUserInputSchema, updateUserInputSchema } from '../contract';
import type { UsersServerHost } from './host';
function validationErrors(error: { issues: Array<{ path: Array<unknown>; message: string }> }): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_root';
    errors[key] ??= [];
    errors[key].push(issue.message);
  }
  return errors;
}

export function createUserRoutes(host: UsersServerHost) {
  function currentActor(context: Context): { id: string; avatar: string | null } | undefined {
    return host.resolveActor(getCookie(context, host.sessionCookieName));
  }

  const createHandler = async (context: Context) => {
    const sessionUser = currentActor(context);
    if (!sessionUser) {
      return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    if (!host.canManageUsers(sessionUser.id, 'create')) {
      return context.json({ success: false as const, message: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }
    const parsed = createUserInputSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(
        { success: false as const, message: 'Validation failed', code: 'VALIDATION_ERROR', errors: validationErrors(parsed.error) },
        422,
      );
    }
    if (parsed.data.roles !== undefined && !host.canAssignRoles(sessionUser.id)) {
      return context.json({ success: false as const, message: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }
    const user = host.createAccount({
      id: randomUUID(),
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: host.hashPassword(parsed.data.password),
    });
    if (parsed.data.roles !== undefined) {
      const roleIds = host
        .availableRoles()
        .filter((role) => (parsed.data.roles as string[]).includes(role.slug))
        .map((role) => role.id);
      host.setUserRoles(user.id, roleIds);
    }
    return context.json({ success: true as const, message: 'User created', data: { user } }, 201);
  };

  const updateHandler = async (context: Context) => {
    const sessionUser = currentActor(context);
    if (!sessionUser) {
      return context.json({ success: false as const, message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    const target = context.req.param('id');
    if (!target) {
      return context.json({ success: false as const, message: 'ID required', code: 'INVALID_ID' }, 400);
    }
${updateGuard}
    const parsed = updateUserInputSchema.safeParse(await context.req.json().catch(() => ({})));
    if (!parsed.success) {
      return context.json(
        { success: false as const, message: 'Validation failed', code: 'VALIDATION_ERROR', errors: validationErrors(parsed.error) },
        422,
      );
    }
    const user = host.updateAccount(target, parsed.data);
    if (!user) {
      return context.json({ success: false as const, message: 'User not found', code: 'NOT_FOUND' }, 404);
    }
    return context.json({ success: true as const, message: 'User updated', data: { user } });
  };

  return new Hono().post('/', createHandler).put('/:id', updateHandler);
}
`;
}

const ROUTES_BASE = routesSource(
  `    if (sessionUser.id !== target && !host.canManageUsers(sessionUser.id, 'edit')) {
  return context.json({ success: false as const, message: 'Forbidden', code: 'FORBIDDEN' }, 403);
} `,
);

const ROUTES_INCOMING = routesSource(
  `    if (!host.canUpdateAccount(sessionUser.id, target)) {
  return context.json({ success: false as const, message: 'Forbidden', code: 'FORBIDDEN' }, 403);
} `,
);

const FEATURE_INDEX = `export { createUserRoutes } from './server/routes';
export type { UsersServerHost } from './server/host';
export { createUserInputSchema, profileInputSchema, updateUserInputSchema } from './contract';
`;

const WEB_INDEX = `export { default } from './pages/UsersPage.vue';
`;

const USERS_PAGE = `<script setup lang="ts">
import type { UserProfile } from '../../contract';

defineProps<{ user: UserProfile }>();
</script>

<template>
  <section class="user-card">
    <h2>{{ user.name }}</h2>
    <p>{{ user.email }}</p>
  </section>
</template>
`;

const MIGRATION_001 = `CREATE TABLE users(
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            avatar TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
`;

const MIGRATION_002 = `ALTER TABLE users ADD COLUMN avatar_retired_at INTEGER;
`;

const AUTH_INDEX = `export interface AuthAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string | null;
}

export interface AuthRole {
  id: string;
  slug: string;
}

const accounts = new Map<string, AuthAccount>();
const roles = new Map<string, AuthRole>();
const assignments = new Map<string, Set<string>>();
const granted = new Map<string, Set<string>>();
const sessions = new Map<string, string>();

export const SESSION_COOKIE_NAME = 'nara_exec_session';

export function resetAuthStore(): void {
  accounts.clear();
  roles.clear();
  assignments.clear();
  granted.clear();
  sessions.clear();
  roles.set('role-admin', { id: 'role-admin', slug: 'admin' });
  roles.set('role-member', { id: 'role-member', slug: 'member' });
  accounts.set('admin-1', { id: 'admin-1', name: 'Ada Admin', email: 'admin@example.com', passwordHash: 'hash:admin', avatar: null });
  accounts.set('member-1', { id: 'member-1', name: 'Moe Member', email: 'member@example.com', passwordHash: 'hash:member', avatar: null });
  accounts.set('support-1', { id: 'support-1', name: 'Sam Support', email: 'support@example.com', passwordHash: 'hash:support', avatar: null });
  assignments.set('admin-1', new Set(['role-admin']));
  assignments.set('member-1', new Set(['role-member']));
  assignments.set('support-1', new Set(['role-member']));
  granted.set('support-1', new Set(['users.edit']));
}

export function seedSession(userId: string): string {
  const token = \`token-\${userId}\`;
  sessions.set(token, userId);
  return token;
}

function publicAccount(account: AuthAccount): { id: string; name: string; email: string; avatar: string | null } {
  return { id: account.id, name: account.name, email: account.email, avatar: account.avatar };
}

export function getCurrentUser(sessionToken: string | undefined): { id: string; avatar: string | null } | undefined {
  if (!sessionToken) return undefined;
  const userId = sessions.get(sessionToken);
  if (!userId) return undefined;
  const account = accounts.get(userId);
  return account ? { id: account.id, avatar: account.avatar } : undefined;
}

export function hashPassword(password: string): string {
  return \`hash:\${password}\`;
}

export function findAccountById(userId: string): { id: string; name: string; email: string; avatar: string | null } | undefined {
  const account = accounts.get(userId);
  return account ? publicAccount(account) : undefined;
}

export function listAccounts(
  page: number,
  limit: number,
  search?: string,
): { data: Array<{ id: string; name: string; email: string; avatar: string | null }>; total: number } {
  const needle = (search ?? '').trim().toLowerCase();
  const all = [...accounts.values()]
    .filter((account) => needle === '' || account.name.toLowerCase().includes(needle) || account.email.toLowerCase().includes(needle))
    .sort((left, right) => (left.id < right.id ? -1 : 1));
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const start = (safePage - 1) * safeLimit;
  return { data: all.slice(start, start + safeLimit).map(publicAccount), total: all.length };
}

export function createAccount(input: { id: string; name: string; email: string; passwordHash: string }): {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
} {
  const account: AuthAccount = { ...input, avatar: null };
  accounts.set(account.id, account);
  assignments.set(account.id, new Set());
  return publicAccount(account);
}

export function updateAccount(
  userId: string,
  patch: { name?: string; email?: string; avatar?: string | null },
): { id: string; name: string; email: string; avatar: string | null } | undefined {
  const account = accounts.get(userId);
  if (!account) return undefined;
  if (patch.name !== undefined) account.name = patch.name;
  if (patch.email !== undefined) account.email = patch.email;
  if (patch.avatar !== undefined) account.avatar = patch.avatar;
  return publicAccount(account);
}

export function deleteAccounts(userIds: string[]): number {
  let removed = 0;
  for (const userId of userIds) {
    if (accounts.delete(userId)) {
      assignments.delete(userId);
      granted.delete(userId);
      removed += 1;
    }
  }
  return removed;
}

export function hasPermission(actorId: string, permission: string): boolean {
  return granted.get(actorId)?.has(permission) ?? false;
}

export function isAdmin(actorId: string): boolean {
  return assignments.get(actorId)?.has('role-admin') ?? false;
}

export function findAllRoles(): AuthRole[] {
  return [...roles.values()];
}

export function getUserRoles(userId: string): AuthRole[] {
  const ids = assignments.get(userId) ?? new Set<string>();
  const found: AuthRole[] = [];
  for (const id of ids) {
    const role = roles.get(id);
    if (role) found.push(role);
  }
  return found;
}

export function syncUserRoles(userId: string, roleIds: string[]): void {
  assignments.set(userId, new Set(roleIds));
}

export function getUsersWithRole(roleId: string): Array<{ id: string }> {
  const holders: Array<{ id: string }> = [];
  for (const [userId, ids] of assignments) {
    if (ids.has(roleId)) holders.push({ id: userId });
  }
  return holders;
}
`;

function bindingSource(extraHostOps: string): string {
  return `import type { Hono } from 'hono';
import {
  createAccount,
  deleteAccounts,
  findAccountById,
  findAllRoles,
  getCurrentUser,
  getUserRoles,
  getUsersWithRole,
  hashPassword,
  hasPermission,
  isAdmin,
  listAccounts,
  SESSION_COOKIE_NAME,
  syncUserRoles,
  updateAccount,
} from '../../features/auth';
import { createUserRoutes, type UsersServerHost } from '../../features/users';

/** Application-owned Users binding. Support staff cannot assign administrative roles. */
export const usersServerHost: UsersServerHost = {
  sessionCookieName: SESSION_COOKIE_NAME,
  resolveActor: (sessionToken) => {
    const user = getCurrentUser(sessionToken);
    return user ? { id: user.id, avatar: user.avatar } : undefined;
  },
  hashPassword: (password) => hashPassword(password),
  findAccountById: (userId) => findAccountById(userId),
  listAccounts: (page, limit, search) => listAccounts(page, limit, search),
  createAccount: (input) => createAccount(input),
  updateAccount: (userId, patch) => updateAccount(userId, patch),
  deleteAccounts: (userIds) => deleteAccounts(userIds),
  canManageUsers: (actorId, action) => isAdmin(actorId) || hasPermission(actorId, \`users.\${action}\`),
  canAssignRoles: (actorId) => isAdmin(actorId),
${extraHostOps}  availableRoles: () => findAllRoles().map((role) => ({ id: role.id, slug: role.slug })),
  rolesForUser: (userId) => getUserRoles(userId).map((role) => role.slug),
  setUserRoles: (userId, roleIds) => {
    syncUserRoles(userId, roleIds);
  },
  usersWithRole: (roleId) => getUsersWithRole(roleId).map((user) => ({ id: user.id })),
};

const userRoutes = createUserRoutes(usersServerHost);

export default function composeUsersServer(app: Hono): void {
  app.route('/api/users', userRoutes);
}
`;
}

const BINDING_INITIAL = bindingSource('');
const BINDING_ADAPTED = bindingSource(
  '  canUpdateAccount: (actorId, targetAccountId) =>\n' +
  '    actorId === targetAccountId || isAdmin(actorId) || (!isAdmin(targetAccountId) && hasPermission(actorId, "users.edit")),\n',
);
const BINDING_BROAD = bindingSource(
  '  canUpdateAccount: (actorId, targetAccountId) => {\n' +
  '    void targetAccountId;\n' +
  '    return isAdmin(actorId) || hasPermission(actorId, "users.edit");\n' +
  '  },\n',
);

const APP_SERVER = `import { Hono } from 'hono';
import composeUsersServer from './bindings/users.server';

export const app = new Hono();
composeUsersServer(app);
`;

const APP_ROUTER = `import UsersPage from '../features/users/web';

export const routes = [{ path: '/users', name: 'users', component: UsersPage }];
`;

const VUE_SHIM = `declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent;
  export default component;
}
`;

const POLICY_TEST = `import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app/server';
import { findAccountById, resetAuthStore, seedSession } from '../src/features/auth';

const SESSION_COOKIE = 'nara_exec_session';

function authedRequest(target: string, token: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { Cookie: \`\${SESSION_COOKIE}=\${token}\`, 'Content-Type': 'application/json' };
  return Promise.resolve(app.request(target, { ...init, headers }));
}

describe('users application policy', () => {
  let admin = '';
  let member = '';
  let support = '';

  beforeEach(() => {
    resetAuthStore();
    admin = seedSession('admin-1');
    member = seedSession('member-1');
    support = seedSession('support-1');
  });

  it('allows an admin to update an ordinary account', async () => {
    const response = await authedRequest('/api/users/member-1', admin, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Moe Updated' }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { user: { name: 'Moe Updated' } } });
  });

  it('denies privileged-account updates from non-admin actors', async () => {
    const response = await authedRequest('/api/users/admin-1', support, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Hacked' }),
    });
    expect(response.status).toBe(403);
  });

  it('denies administrative role assignment by support staff', async () => {
    const response = await authedRequest('/api/users', support, {
      method: 'POST',
      body: JSON.stringify({ name: 'New Hire', email: 'hire@example.com', password: 'password-1', roles: ['admin'] }),
    });
    expect(response.status).toBe(403);
  });

  it('rejects reserved display names while keeping local policy', async () => {
    const response = await authedRequest('/api/users/member-1', admin, {
      method: 'PUT',
      body: JSON.stringify({ name: 'System' }),
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { errors: Record<string, string[]> };
    expect(body.errors.name?.join(' ')).toContain('reserved');
  });

  it('leaves state unchanged after denied operations', async () => {
    const before = findAccountById('support-1')?.name;
    const response = await authedRequest('/api/users/support-1', member, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Mutated' }),
    });
    expect(response.status).toBe(403);
    expect(findAccountById('support-1')?.name).toBe(before);
  });
});
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "skipLibCheck": true,
    "noEmit": true,
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "build"]
}
`;

const TSCONFIG_FRONTEND = `{
  "compilerOptions": {
    "target": "es2022",
    "useDefineForClassFields": true,
    "module": "esnext",
    "lib": ["es2022", "dom", "dom.iterable"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["resources/**/*.ts", "resources/**/*.vue", "src/app/**/*.vue", "src/features/**/*.vue"]
}
`;

const VITE_CONFIG = `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: { outDir: 'build/client', emptyOutDir: true },
});
`;

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Users transition proof</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/resources/app.ts"></script>
  </body>
</html>
`;

const RESOURCES_APP = `import { createApp, h } from 'vue';
import UsersPage from '../src/features/users/web/pages/UsersPage.vue';

createApp({
  render: () =>
    h(UsersPage, { user: { id: 'preview', name: 'Preview', email: 'preview@example.com', avatar: null } }),
}).mount('#app');
`;

function baseFeatureFiles(): Map<string, Buffer> {
  return new Map<string, Buffer>([
    ['contract.ts', Buffer.from(CONTRACT_BASE)],
    ['index.ts', Buffer.from(FEATURE_INDEX)],
    ['server/host.ts', Buffer.from(HOST_BASE)],
    ['server/routes.ts', Buffer.from(ROUTES_BASE)],
    ['server/migrations/000001_create_users.sql', Buffer.from(MIGRATION_001)],
    ['web/index.ts', Buffer.from(WEB_INDEX)],
    ['web/pages/UsersPage.vue', Buffer.from(USERS_PAGE)],
  ]);
}

function localFeatureFiles(): Map<string, Buffer> {
  const files = baseFeatureFiles();
  files.set('contract.ts', Buffer.from(contractLocal()));
  return files;
}

function incomingFeatureFiles(): Map<string, Buffer> {
  return new Map<string, Buffer>([
    ['contract.ts', Buffer.from(contractIncoming())],
    ['index.ts', Buffer.from(FEATURE_INDEX)],
    ['server/host.ts', Buffer.from(HOST_INCOMING)],
    ['server/routes.ts', Buffer.from(ROUTES_INCOMING)],
    ['server/migrations/000001_create_users.sql', Buffer.from(MIGRATION_001)],
    ['server/migrations/000002_avatar_retirement.sql', Buffer.from(MIGRATION_002)],
    ['web/index.ts', Buffer.from(WEB_INDEX)],
    ['web/pages/UsersPage.vue', Buffer.from(USERS_PAGE)],
  ]);
}

function writeFeatureTree(directory: string, files: Map<string, Buffer>): void {
  for (const [relativePath, bytes] of files) {
    writeText(path.join(directory, ...relativePath.split('/')), bytes.toString('utf8'));
  }
}

interface ExecutableFixture {
  root: string;
  officialDirectory: string;
  historyFixture: string;
}

function setupExecutableFixture(binding: string): ExecutableFixture {
  const root = track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-exec-')));
  const officialDirectory = track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-exec-incoming-')));
  const base = baseFeatureFiles();
  writeFeatureTree(path.join(root, 'src', 'features', 'users'), localFeatureFiles());
  writeText(path.join(root, 'src', 'features', 'auth', 'index.ts'), AUTH_INDEX);
  writeText(path.join(root, 'src', 'app', 'server.ts'), APP_SERVER);
  writeText(path.join(root, 'src', 'app', 'router.ts'), APP_ROUTER);
  writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), binding);
  writeText(path.join(root, 'src', 'vue-shim.d.ts'), VUE_SHIM);
  writeText(path.join(root, 'tests', 'users-policy.test.ts'), POLICY_TEST);
  writeText(
    path.join(root, 'package.json'),
    `${JSON.stringify(
      {
        name: 'users-transition-proof',
        private: true,
        dependencies: { hono: '^4.13.5', vue: '^3.5.42', zod: '^4.4.3' },
        devDependencies: {
          '@vitejs/plugin-vue': '^6.0.8',
          typescript: '^5.6.3',
          vite: '^8.2.1',
          vitest: '^4.1.10',
          'vue-tsc': '^3.3.11',
        },
        scripts: { build: 'vite build' },
      },
      null,
      2,
    )}\n`,
  );
  writeText(path.join(root, 'tsconfig.json'), `${TSCONFIG}\n`);
  writeText(path.join(root, 'tsconfig.frontend.json'), `${TSCONFIG_FRONTEND}\n`);
  writeText(path.join(root, 'vite.config.mjs'), `${VITE_CONFIG}\n`);
  writeText(path.join(root, 'index.html'), `${INDEX_HTML}\n`);
  writeText(path.join(root, 'resources', 'app.ts'), `${RESOURCES_APP}\n`);
  writeText(
    path.join(root, '.nara', 'transitions', 'users.checks.json'),
    `${JSON.stringify({ schemaVersion: 1, tests: ['tests/users-policy.test.ts'], historyFixture: '.nara/test-fixtures/history.sqlite3' }, null, 2)}\n`,
  );
  const lineageDirectory = path.join(root, '.nara', 'lineage', 'official-features', 'users');
  writeFeatureTree(path.join(lineageDirectory, 'base'), base);
  writeText(
    path.join(lineageDirectory, 'lineage.json'),
    `${JSON.stringify({ schemaVersion: 1, feature: 'users', source: 'official-feature', baseDigest: digestFeatureFiles(base) }, null, 2)}\n`,
  );
  writeFeatureTree(officialDirectory, incomingFeatureFiles());
  const historyFixture = path.join(root, '.nara', 'test-fixtures', 'history.sqlite3');
  mkdirSync(path.dirname(historyFixture), { recursive: true });
  const stage = track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-exec-stage-')));
  writeFeatureTree(path.join(stage, 'users', 'server', 'migrations'), new Map([['000001_create_users.sql', Buffer.from(MIGRATION_001)]]));
  const database = new Database(historyFixture);
  try {
    migrate({ database, featureRoots: [stage] });
    database
      .prepare('INSERT INTO users (id, name, email, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('admin-1', 'Ada Admin', 'admin@example.com', null, 1, 1);
    database
      .prepare('INSERT INTO users (id, name, email, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('member-1', 'Moe Member', 'member@example.com', null, 2, 2);
  } finally {
    database.close();
  }
  const repoModules = path.resolve('node_modules');
  expect(existsSync(repoModules)).toBe(true);
  symlinkSync(repoModules, path.join(root, 'node_modules'), 'junction');
  return { root, officialDirectory, historyFixture };
}

describe('users executable feature transition', () => {
  it(
    'verifies a real adapted candidate end to end and accepts it',
    async () => {
      const fixture = setupExecutableFixture(BINDING_INITIAL);
      const initial = planTransition({ feature: 'users', cwd: fixture.root, officialDirectory: fixture.officialDirectory });
      expect(initial.ok).toBe(true);
      if (!initial.ok) return;
      expect(initial.receipt.outcome).toBe('BLOCKED');
      expect(initial.receipt.evidence.find((item) => item.kind === 'typecheck')?.status).toBe('fail');

      writeText(path.join(fixture.root, 'src', 'app', 'bindings', 'users.server.ts'), BINDING_ADAPTED);
      const packageBefore = readFileSync(path.join(fixture.root, 'package.json'), 'utf8');
      const historyBefore = sha256File(fixture.historyFixture);

      const outcome = planTransition({ feature: 'users', cwd: fixture.root, officialDirectory: fixture.officialDirectory });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.receipt.outcome).toBe('VERIFIED');
      for (const kind of ['typecheck', 'frontend-typecheck', 'build', 'app-tests', 'migration-fresh', 'migration-history', 'architecture-diff', 'doctor', 'package-compat', 'source-reconciliation']) {
        expect(outcome.receipt.evidence.find((item) => item.kind === kind)?.status).toBe('pass');
      }
      expect(outcome.receipt.historyFixtures).toHaveLength(1);
      expect(outcome.receipt.historyFixtures[0]?.digest).toBe(historyBefore);

      const accepted = acceptTransition({ feature: 'users', cwd: fixture.root, officialDirectory: fixture.officialDirectory });
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) return;
      expect(accepted.receipt.acceptance.state).toBe('accepted');

      expect(readFileSync(path.join(fixture.root, 'src', 'features', 'users', 'server', 'routes.ts'), 'utf8')).toContain('canUpdateAccount');
      expect(readFileSync(path.join(fixture.root, 'src', 'features', 'users', 'contract.ts'), 'utf8')).toContain('RESERVED_DISPLAY_NAMES');
      expect(readFileSync(path.join(fixture.root, 'src', 'app', 'bindings', 'users.server.ts'), 'utf8')).toContain('canUpdateAccount');
      const lineageFiles = readFeatureFiles(path.join(fixture.root, '.nara', 'lineage', 'official-features', 'users', 'base'));
      expect(digestFeatureFiles(lineageFiles)).toBe(outcome.receipt.incomingDigest);
      expect(readFileSync(path.join(fixture.root, '.nara', 'lineage', 'official-features', 'users', 'base', 'contract.ts'), 'utf8')).not.toContain(
        'RESERVED_DISPLAY_NAMES',
      );
      expect(sha256File(fixture.historyFixture)).toBe(historyBefore);
      expect(readFileSync(path.join(fixture.root, 'package.json'), 'utf8')).toBe(packageBefore);
      expect(existsSync(path.join(fixture.root, 'package-lock.json'))).toBe(false);
    },
    300_000,
  );

  it(
    'blocks a type-compatible but policy-wrong binding with real test evidence',
    async () => {
      const fixture = setupExecutableFixture(BINDING_BROAD);
      const outcome = planTransition({ feature: 'users', cwd: fixture.root, officialDirectory: fixture.officialDirectory });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.receipt.outcome).toBe('BLOCKED');
      expect(outcome.receipt.evidence.find((item) => item.kind === 'typecheck')?.status).toBe('pass');
      expect(outcome.receipt.evidence.find((item) => item.kind === 'app-tests')?.status).toBe('fail');
      const refused = acceptTransition({ feature: 'users', cwd: fixture.root, officialDirectory: fixture.officialDirectory });
      expect(refused.ok).toBe(false);
    },
    300_000,
  );
});

