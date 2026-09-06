import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../shared/database/migrator';
import { digestFeatureFiles, readFeatureFiles } from './lineage';
import { isReceiptStale, readCurrentTransition, transitionIdentity } from './transition';
import { acceptTransition, planTransition } from '../commands/transition';
import { rehearseHistoryMigration, stageCandidateFeatureRoots } from './transition-migrations';

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

const BASE_CONTRACT = `import { z } from 'zod';

export const profileInputSchema = z.object({ name: z.string().min(2) });
export type ProfileInput = z.infer<typeof profileInputSchema>;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}
`;

const INCOMING_CONTRACT = `import { z } from 'zod';

export const profileInputSchema = z.object({ name: z.string().min(2) });
export type ProfileInput = z.infer<typeof profileInputSchema>;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  avatarRetiredAt?: number | null;
}
`;

const BASE_HOST = `import type { UserProfile } from '../contract';

export interface UsersAccountUpdateInput {
  name?: string;
  email?: string;
}

export interface UsersAuthorizationHost {
  canManageUsers(actorId: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean;
  canAssignRoles(actorId: string): boolean;
}

export interface UsersServerHost extends UsersAuthorizationHost {
  readonly sessionCookieName: string;
  findAccountById(userId: string): UserProfile | undefined;
  updateAccount(userId: string, patch: UsersAccountUpdateInput): UserProfile | undefined;
}
`;

const INCOMING_HOST = `import type { UserProfile } from '../contract';

export interface UsersAccountUpdateInput {
  name?: string;
  email?: string;
}

export interface UsersAuthorizationHost {
  canManageUsers(actorId: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean;
  canAssignRoles(actorId: string): boolean;
  canUpdateAccount(actorId: string, targetAccountId: string): boolean;
}

export interface UsersServerHost extends UsersAuthorizationHost {
  readonly sessionCookieName: string;
  findAccountById(userId: string): UserProfile | undefined;
  updateAccount(userId: string, patch: UsersAccountUpdateInput): UserProfile | undefined;
}
`;

const BASE_ROUTES = `import { Hono } from 'hono';
import type { UsersServerHost } from './host';

export function createUserRoutes(host: UsersServerHost) {
  return new Hono().put('/:id', async (context) => {
    const actor = context.req.query('actor') ?? '';
    const target = context.req.param('id') ?? '';
    if (actor !== target && !host.canManageUsers(actor, 'edit')) {
      return context.json({ success: false as const, message: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }
    return context.json({ success: true as const, message: 'User updated' });
  });
}
`;

const INCOMING_ROUTES = `import { Hono } from 'hono';
import type { UsersServerHost } from './host';

export function createUserRoutes(host: UsersServerHost) {
  return new Hono().put('/:id', async (context) => {
    const actor = context.req.query('actor') ?? '';
    const target = context.req.param('id') ?? '';
    if (!host.canUpdateAccount(actor, target)) {
      return context.json({ success: false as const, message: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }
    return context.json({ success: true as const, message: 'User updated' });
  });
}
`;

const FEATURE_INDEX = `export { createUserRoutes } from './server/routes';
export type { UsersServerHost } from './server/host';
export { profileInputSchema } from './contract';
`;

const BASE_MIGRATION = `CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar TEXT
);
`;

const AVATAR_MIGRATION = `ALTER TABLE users ADD COLUMN avatar_retired_at INTEGER;
`;

const LOCAL_DISPLAY_NAMES = `/** Application-reserved display names are rejected. */
export const RESERVED_DISPLAY_NAMES = ['admin', 'support', 'system'];

export function isReservedDisplayName(name: string): boolean {
  return RESERVED_DISPLAY_NAMES.includes(name.trim().toLowerCase());
}
`;

const AUTH_INDEX = `export function getCurrentUser(sessionToken: string | undefined): { id: string; avatar: string | null } | undefined {
  return sessionToken ? { id: 'user-1', avatar: null } : undefined;
}
export function hashPassword(password: string): string {
  return \`hash:\${password}\`;
}
export function findAccountById(userId: string): { id: string; name: string; email: string; avatar: string | null } | undefined {
  return { id: userId, name: 'Member', email: 'member@example.com', avatar: null };
}
export function listAccounts(page: number, limit: number, search?: string): { data: Array<{ id: string; name: string; email: string; avatar: string | null }>; total: number } {
  void page;
  void limit;
  void search;
  return { data: [], total: 0 };
}
export function createAccount(input: { id: string; name: string; email: string }): { id: string; name: string; email: string; avatar: string | null } {
  return { id: input.id, name: input.name, email: input.email, avatar: null };
}
export function updateAccount(userId: string, patch: Record<string, unknown>): { id: string; name: string; email: string; avatar: string | null } | undefined {
  void patch;
  return { id: userId, name: 'Member', email: 'member@example.com', avatar: null };
}
export function deleteAccounts(userIds: string[]): number {
  return userIds.length;
}
export function hasPermission(actorId: string, permission: string): boolean {
  void actorId;
  void permission;
  return false;
}
export function isAdmin(actorId: string): boolean {
  return actorId === 'admin-1';
}
export function findAllRoles(): Array<{ id: string; slug: string }> {
  return [{ id: 'role-admin', slug: 'admin' }];
}
export function getUserRoles(userId: string): Array<{ slug: string }> {
  void userId;
  return [];
}
export function syncUserRoles(userId: string, roleIds: string[]): void {
  void userId;
  void roleIds;
}
export function getUsersWithRole(roleId: string): Array<{ id: string }> {
  void roleId;
  return [{ id: 'admin-1' }];
}
export const SESSION_COOKIE_NAME = 'nara_session';
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
  void userRoutes;
  app.route('/api/users', userRoutes);
}
`;
}

const INITIAL_BINDING = bindingSource('');
const ADAPTED_BINDING = bindingSource(
  "  canUpdateAccount: (actorId, targetAccountId) =>\n" +
  "    actorId === targetAccountId || isAdmin(actorId) || hasPermission(actorId, 'users.edit'),\n",
);
const INCORRECT_BINDING = bindingSource(
  "  canUpdateAccount: (actorId, targetAccountId) =>\n" +
  "    isAdmin(actorId) || hasPermission(actorId, 'users.edit'),\n",
);

const APP_SERVER = `import { Hono } from 'hono';
import composeUsersServer from './bindings/users.server';

export const app = new Hono();
composeUsersServer(app);
`;

const APP_ROUTER = `export const routes = [{ path: '/users', name: 'users', component: {} }];
`;

function baseFiles(): Map<string, Buffer> {
  return new Map<string, Buffer>([
    ['contract.ts', Buffer.from(BASE_CONTRACT)],
    ['index.ts', Buffer.from(FEATURE_INDEX)],
    ['server/host.ts', Buffer.from(BASE_HOST)],
    ['server/routes.ts', Buffer.from(BASE_ROUTES)],
    ['server/migrations/000001_create_users.sql', Buffer.from(BASE_MIGRATION)],
  ]);
}

function incomingFiles(): Map<string, Buffer> {
  return new Map<string, Buffer>([
    ['contract.ts', Buffer.from(INCOMING_CONTRACT)],
    ['index.ts', Buffer.from(FEATURE_INDEX)],
    ['server/host.ts', Buffer.from(INCOMING_HOST)],
    ['server/routes.ts', Buffer.from(INCOMING_ROUTES)],
    ['server/migrations/000001_create_users.sql', Buffer.from(BASE_MIGRATION)],
    ['server/migrations/000002_avatar_retirement.sql', Buffer.from(AVATAR_MIGRATION)],
  ]);
}

function localFiles(): Map<string, Buffer> {
  const files = baseFiles();
  files.set('server/display-names.ts', Buffer.from(LOCAL_DISPLAY_NAMES));
  return files;
}

function writeFeatureTree(directory: string, files: Map<string, Buffer>): void {
  for (const [relativePath, bytes] of files) {
    writeText(path.join(directory, ...relativePath.split('/')), bytes.toString('utf8'));
  }
}

function writeLineage(root: string, base: Map<string, Buffer>): void {
  const directory = path.join(root, '.nara', 'lineage', 'official-features', 'users');
  writeFeatureTree(path.join(directory, 'base'), base);
  writeText(
    path.join(directory, 'lineage.json'),
    `${JSON.stringify({ schemaVersion: 1, feature: 'users', source: 'official-feature', baseDigest: digestFeatureFiles(base) }, null, 2)}\n`,
  );
}

interface UsersFixture {
  root: string;
  officialDirectory: string;
}

function setupFixture(official: Map<string, Buffer> = incomingFiles()): UsersFixture {
  const root = track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-users-')));
  const officialDirectory = track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-incoming-')));
  const base = baseFiles();
  writeFeatureTree(path.join(root, 'src', 'features', 'users'), localFiles());
  writeFeatureTree(path.join(root, 'src', 'features', 'auth'), new Map([['index.ts', Buffer.from(AUTH_INDEX)]]));
  writeText(path.join(root, 'src', 'app', 'server.ts'), APP_SERVER);
  writeText(path.join(root, 'src', 'app', 'router.ts'), APP_ROUTER);
  writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), INITIAL_BINDING);
  writeText(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'transition-fixture', private: true, dependencies: { hono: '^4.13.5', zod: '^4.4.3' } }, null, 2)}\n`,
  );
  writeText(
    path.join(root, '.nara', 'transitions', 'users.checks.json'),
    `${JSON.stringify({ schemaVersion: 1, tests: ['src/features/users/tests/policy.test.ts', 'tests/users-policy.test.ts'] }, null, 2)}\n`,
  );
  writeLineage(root, base);
  writeFeatureTree(officialDirectory, official);
  return { root, officialDirectory };
}

function planPass(root: string, officialDirectory: string, extra?: { historyFixturePath?: string; appTests?: 'pass' | 'fail' }): ReturnType<typeof planTransition> {
  return planTransition({
    feature: 'users',
    cwd: root,
    officialDirectory,
    skipExec: true,
    ...(extra?.historyFixturePath ? { historyFixturePath: extra.historyFixturePath } : {}),
    injected: {
      typecheck: { status: 'pass', detail: 'TypeScript typecheck passed for the candidate.' },
      'frontend-typecheck': { status: 'pass', detail: 'Frontend typecheck passed for the candidate.' },
      build: { status: 'pass', detail: 'Application build passed for the candidate.' },
      'app-tests': extra?.appTests === 'fail'
        ? { status: 'fail', detail: 'Application-owned policy tests failed for the candidate.' }
        : { status: 'pass', detail: 'Application-owned policy tests passed for the candidate.' },
    },
  });
}

function buildHistoryFixture(targetPath: string): void {
  const stage = track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-history-stage-')));
  writeFeatureTree(path.join(stage, 'users', 'server', 'migrations'), new Map([['000001_create_users.sql', Buffer.from(BASE_MIGRATION)]]));
  const database = new Database(targetPath);
  try {
    migrate({ database, featureRoots: [stage] });
    database.prepare("INSERT INTO users (id, name, email, avatar) VALUES ('admin-1', 'Admin', 'admin@example.com', NULL)").run();
    database.prepare("INSERT INTO users (id, name, email, avatar) VALUES ('user-1', 'Member', 'member@example.com', NULL)").run();
  } finally {
    database.close();
  }
}

function snapshotSource(root: string): Map<string, string> {
  const entries = new Map<string, string>();
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.nara' || entry.name === 'node_modules') continue;
        visit(absolute);
      } else if (entry.isFile()) {
        entries.set(path.relative(root, absolute), readFileSync(absolute, 'utf8'));
      }
    }
  };
  visit(path.join(root, 'src'));
  return entries;
}

describe('users application-verified transition', () => {
  it('detects the changed host obligation and starts BLOCKED', () => {
    const { root, officialDirectory } = setupFixture();
    const before = snapshotSource(root);
    const outcome = planTransition({
      feature: 'users',
      cwd: root,
      officialDirectory,
      skipExec: true,
      injected: {
        typecheck: { status: 'fail', detail: 'Binding does not implement canUpdateAccount.' },
        'frontend-typecheck': { status: 'pass', detail: 'Frontend typecheck passed.' },
        build: { status: 'pass', detail: 'Build passed.' },
        'app-tests': { status: 'fail', detail: 'Policy tests failed.' },
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('BLOCKED');
    const ids = outcome.receipt.obligations.map((obligation) => obligation.id);
    expect(ids).toContain('host:requirements-changed');
    expect(ids).toContain('binding:unsatisfied-host');
    expect(ids).toContain('migration:rehearse-new');
    expect(ids).toContain('behavioral:application-tests');
    expect(outcome.receipt.evidence.find((item) => item.kind === 'source-reconciliation')?.status).toBe('pass');
    expect(outcome.receipt.limitations).toContain(
      'Nara never infers full business intent from structural analysis.',
    );
    expect(snapshotSource(root)).toEqual(before);
    const stored = readCurrentTransition(root, 'users');
    expect(stored?.candidateDigest).toBe(outcome.receipt.candidateDigest);
    const candidate = readFileSync(path.join(root, 'src', 'features', 'users', 'server', 'routes.ts'), 'utf8');
    expect(candidate).not.toContain('canUpdateAccount');
  });

  it('proves the full verified path: adaptation, behavior, histories, acceptance, lineage', () => {
    const { root, officialDirectory } = setupFixture();
    const fixtureDb = path.join(track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-'))), 'history.sqlite3');
    buildHistoryFixture(fixtureDb);

    const bindingPath = path.join(root, 'src', 'app', 'bindings', 'users.server.ts');
    const bindingBefore = readFileSync(bindingPath, 'utf8');
    writeText(bindingPath, ADAPTED_BINDING);

    const outcome = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('VERIFIED');
    expect(outcome.receipt.obligations.every((obligation) => obligation.status === 'verified')).toBe(true);
    expect(outcome.receipt.evidence.find((item) => item.kind === 'migration-fresh')?.status).toBe('pass');
    expect(outcome.receipt.evidence.find((item) => item.kind === 'migration-history')?.status).toBe('pass');
    expect(outcome.receipt.evidence.every((item) => item.candidateDigest === outcome.receipt.candidateDigest)).toBe(true);

    const accepted = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.receipt.acceptance.state).toBe('accepted');

    const localRoutes = readFileSync(path.join(root, 'src', 'features', 'users', 'server', 'routes.ts'), 'utf8');
    expect(localRoutes).toContain('canUpdateAccount');
    expect(readFileSync(path.join(root, 'src', 'features', 'users', 'server', 'display-names.ts'), 'utf8')).toContain(
      'RESERVED_DISPLAY_NAMES',
    );
    expect(readFileSync(bindingPath, 'utf8')).toContain('canUpdateAccount');
    expect(readFileSync(bindingPath, 'utf8')).not.toBe(bindingBefore);

    const lineageFiles = readFeatureFiles(path.join(root, '.nara', 'lineage', 'official-features', 'users', 'base'));
    expect(digestFeatureFiles(lineageFiles)).toBe(outcome.receipt.incomingDigest);
    expect(lineageFiles.has('server/display-names.ts')).toBe(false);
    const lineageRecord = JSON.parse(
      readFileSync(path.join(root, '.nara', 'lineage', 'official-features', 'users', 'lineage.json'), 'utf8'),
    ) as { baseDigest: string; acceptedTransition?: string };
    expect(lineageRecord.baseDigest).toBe(outcome.receipt.incomingDigest);
    expect(lineageRecord.acceptedTransition).toBe(outcome.receipt.transitionId);
    expect(existsSync(path.join(root, '.nara', 'transitions', 'users', 'history', `${outcome.receipt.candidateDigest}.json`))).toBe(true);
  });

  it('keeps a structurally compiling but behaviorally wrong binding BLOCKED', () => {
    const { root, officialDirectory } = setupFixture();
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), INCORRECT_BINDING);
    const outcome = planPass(root, officialDirectory, { appTests: 'fail' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('BLOCKED');
    expect(outcome.receipt.evidence.find((item) => item.kind === 'typecheck')?.status).toBe('pass');
    expect(outcome.receipt.evidence.find((item) => item.kind === 'app-tests')?.status).toBe('fail');
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('not-verified');
  });

  it('blocks modified applied migrations before SQL and refuses lineage advancement', () => {
    const tampered = incomingFiles();
    tampered.set(
      'server/migrations/000001_create_users.sql',
      Buffer.from(`${BASE_MIGRATION}ALTER TABLE users ADD COLUMN nickname TEXT;\n`),
    );
    const { root, officialDirectory } = setupFixture(tampered);
    const fixtureDb = path.join(track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-'))), 'history.sqlite3');
    buildHistoryFixture(fixtureDb);
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const outcome = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('BLOCKED');
    expect(outcome.receipt.evidence.find((item) => item.kind === 'migration-history')?.status).toBe('fail');
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('not-verified');
    const lineageRecord = JSON.parse(
      readFileSync(path.join(root, '.nara', 'lineage', 'official-features', 'users', 'lineage.json'), 'utf8'),
    ) as { baseDigest: string };
    expect(lineageRecord.baseDigest).toBe(outcome.receipt.baseDigest);
  });

  it('treats same-bytes migration ownership moves as compatible history', () => {
    const moved = new Map<string, Map<string, Buffer>>([
      ['users', new Map([['server/migrations/000001_create_users.sql', Buffer.from(BASE_MIGRATION)]])],
    ]);
    const staged = stageCandidateFeatureRoots(moved, []);
    try {
      const fixtureDb = path.join(track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-'))), 'history.sqlite3');
      const authStage = track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-auth-')));
      writeFeatureTree(path.join(authStage, 'auth', 'server', 'migrations'), new Map([['000001_create_users.sql', Buffer.from(BASE_MIGRATION)]]));
      const database = new Database(fixtureDb);
      try {
        migrate({ database, featureRoots: [authStage] });
      } finally {
        database.close();
      }
      const result = rehearseHistoryMigration([staged.featuresRoot], { fixturePath: fixtureDb });
      expect(result.status).toBe('pass');
    } finally {
      rmSync(staged.directory, { recursive: true, force: true });
    }
  });

  it('reports UNVERIFIED without a history fixture and refuses acceptance', () => {
    const { root, officialDirectory } = setupFixture();
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const outcome = planPass(root, officialDirectory);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('UNVERIFIED');
    const historyEvidence = outcome.receipt.evidence.find((item) => item.kind === 'migration-history');
    expect(historyEvidence?.status).toBe('missing');
    expect(historyEvidence?.detail ?? '').toContain('existing database history was not established');
    expect(outcome.receipt.limitations.join('\n')).toContain('Fresh installation');
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('not-verified');
  });

  it('rejects stale candidates at acceptance time and keeps receipts deterministic', () => {
    const { root, officialDirectory } = setupFixture();
    const fixtureDb = path.join(track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-'))), 'history.sqlite3');
    buildHistoryFixture(fixtureDb);
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const first = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstJson = JSON.stringify(readCurrentTransition(root, 'users'));
    const second = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(JSON.stringify(readCurrentTransition(root, 'users'))).toBe(firstJson);
    expect(second.receipt.transitionId).toBe(
      transitionIdentity('users', second.receipt.baseDigest, second.receipt.localStartDigest, second.receipt.incomingTransitionDigest),
    );
    writeText(
      path.join(root, 'src', 'app', 'bindings', 'users.server.ts'),
      `${ADAPTED_BINDING}\n// candidate revision changes\n`,
    );
    expect(isReceiptStale(first.receipt, second.receipt.candidateDigest)).toBe(false);
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('stale-candidate');
  });

  it('blocks package prerequisites without silently modifying package state', () => {
    const official = incomingFiles();
    const { root, officialDirectory } = setupFixture(official);
    writeText(
      path.join(officialDirectory, '.nara', 'requirements.json'),
      `${JSON.stringify({ schemaVersion: 1, providers: ['auth'], packages: { sharp: '^99.0.0' } }, null, 2)}\n`,
    );
    const packageBefore = readFileSync(path.join(root, 'package.json'), 'utf8');
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const outcome = planTransition({
      feature: 'users',
      cwd: root,
      officialDirectory,
      skipExec: true,
      injected: {
        typecheck: { status: 'pass', detail: 'TypeScript typecheck passed.' },
        'frontend-typecheck': { status: 'pass', detail: 'Frontend typecheck passed.' },
        build: { status: 'pass', detail: 'Build passed.' },
        'app-tests': { status: 'pass', detail: 'Application tests passed.' },
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('BLOCKED');
    expect(outcome.receipt.obligations.map((obligation) => obligation.id)).toContain('package:sharp-missing');
    expect(readFileSync(path.join(root, 'package.json'), 'utf8')).toBe(packageBefore);
  });

  it('rejects acceptance after provider source changes without touching users', () => {
    const { root, officialDirectory } = setupFixture();
    const fixtureDb = path.join(track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-'))), 'history.sqlite3');
    buildHistoryFixture(fixtureDb);
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const outcome = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('VERIFIED');
    const authIndex = path.join(root, 'src', 'features', 'auth', 'index.ts');
    writeText(authIndex, `${readFileSync(authIndex, 'utf8')}\n// provider behavior rotation\n`);
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('stale-candidate');
  });

  it('rejects acceptance after shared application source changes', () => {
    const { root, officialDirectory } = setupFixture();
    const fixtureDb = path.join(track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-'))), 'history.sqlite3');
    buildHistoryFixture(fixtureDb);
    const sharedModule = path.join(root, 'src', 'shared', 'policy.ts');
    writeText(sharedModule, 'export function sharedPolicy(): string {\n  return "v1";\n}\n');
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const outcome = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('VERIFIED');
    expect(outcome.receipt.appInputs.map((input) => input.path)).toContain('src/shared/policy.ts');
    writeText(sharedModule, 'export function sharedPolicy(): string {\n  return "v2";\n}\n');
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('stale-candidate');
  });

  it('rejects acceptance after incoming requirements change with identical source', () => {
    const { root, officialDirectory } = setupFixture();
    const fixtureDb = path.join(track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-'))), 'history.sqlite3');
    buildHistoryFixture(fixtureDb);
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const outcome = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('VERIFIED');
    writeText(
      path.join(officialDirectory, '.nara', 'requirements.json'),
      `${JSON.stringify({ schemaVersion: 1, providers: ['auth'], packages: { zod: '^4.4.3' } }, null, 2)}\n`,
    );
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('stale-candidate');
  });

  it('binds verified history evidence to the exact fixture and rejects drift', () => {
    const { root, officialDirectory } = setupFixture();
    const fixtureDb = path.join(track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-'))), 'history.sqlite3');
    buildHistoryFixture(fixtureDb);
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const outcome = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('VERIFIED');
    expect(outcome.receipt.historyFixtures).toHaveLength(1);
    expect(outcome.receipt.historyFixtures[0]?.path).toBe(fixtureDb);
    expect(typeof outcome.receipt.historyFixtures[0]?.digest).toBe('string');
    expect(outcome.receipt.historyFixtures[0]?.historyIds).toContain('000001');
    const historyEvidence = outcome.receipt.evidence.find((item) => item.kind === 'migration-history');
    expect(historyEvidence?.fixture?.digest).toBe(outcome.receipt.historyFixtures[0]?.digest);

    const accepted = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(accepted.ok).toBe(true);

    const drifted = new Database(fixtureDb);
    try {
      drifted.prepare("INSERT INTO users (id, name, email, avatar) VALUES ('late-1', 'Late', 'late@example.com', NULL)").run();
    } finally {
      drifted.close();
    }
    const second = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const changed = second.receipt.historyFixtures[0]?.digest !== outcome.receipt.historyFixtures[0]?.digest;
    expect(changed).toBe(true);
  });

  it('rejects old history evidence when the fixture goes missing', () => {
    const { root, officialDirectory } = setupFixture();
    const fixtureDir = track(mkdtempSync(path.join(os.tmpdir(), 'nara-transition-db-')));
    const fixtureDb = path.join(fixtureDir, 'history.sqlite3');
    buildHistoryFixture(fixtureDb);
    writeText(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), ADAPTED_BINDING);
    const outcome = planPass(root, officialDirectory, { historyFixturePath: fixtureDb });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.receipt.outcome).toBe('VERIFIED');
    rmSync(fixtureDb, { force: true });
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('stale-candidate');
  });

  it('fails clearly on previous receipt schemas instead of accepting them', () => {
    const { root, officialDirectory } = setupFixture();
    writeText(
      path.join(root, '.nara', 'transitions', 'users', 'current.json'),
      JSON.stringify({ schemaVersion: 2, feature: 'users' }),
    );
    const refused = acceptTransition({ feature: 'users', cwd: root, officialDirectory });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.errorCode).toBe('no-transition');
    expect(refused.error.message).toContain('schemaVersion 3');
  });
});
