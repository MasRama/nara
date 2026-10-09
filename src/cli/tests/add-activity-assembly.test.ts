import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeArchitecture } from '../architecture/doctor';
import { readFeatureLineage } from '../evolution/lineage';
import { installOfficialFeature } from '../composition/install-feature';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function writeFiles(directory: string, files: Record<string, string>): void {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(directory, ...relative.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

const AUTH_BOUNDARY = `export const declarePermissions = (): void => {};
export const getCurrentUser = (): undefined => undefined;
export const hasPermission = (): boolean => false;
export const isAdmin = (): boolean => false;
export const SESSION_COOKIE_NAME = 'auth_id';
`;

const ROUTER_ROOT = `import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: HomePage,
    },
  ],
});
`;

/** A Nara application with Auth and the guaranteed shared modules, but no Activity. */
function createApplication(auth = AUTH_BOUNDARY): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-activity-assembly-'));
  fixtures.push(fixture);
  writeFiles(fixture, {
    ...Object.fromEntries(
      ['config', 'database', 'realtime', 'realtime/browser', 'security', 'security/permissions'].map((entry) => [
        `src/shared/${entry}.ts`,
        'export {};\n',
      ]),
    ),
    'src/app/server.ts': `import { Hono } from 'hono';\n\nexport const app = new Hono();\n`,
    'src/app/router.ts': ROUTER_ROOT,
    'package.json': '{\n  "name": "fixture",\n  "version": "0.0.0",\n  "dependencies": {}\n}\n',
    'src/features/auth/index.ts': auth,
  });
  return fixture;
}

describe('activity feature assembly', () => {
  it('installs Activity with its bindings, migration, lineage and package', () => {
    const fixture = createApplication();

    const result = installOfficialFeature('activity', fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const file of [
      'src/features/activity/contract.ts',
      'src/features/activity/server/routes.ts',
      'src/features/activity/server/retention.ts',
      'src/features/activity/web/pages/ActivityPage.vue',
      'src/features/activity/server/migrations/202610050001_create_activity_events.sql',
      'src/features/activity/tests/config.test.ts',
    ]) {
      expect(existsSync(path.join(fixture, file)), file).toBe(true);
    }
    // Tests that boot the reference application stay local to it.
    expect(existsSync(path.join(fixture, 'src/features/activity/tests/routes.test.ts'))).toBe(false);

    expect(result.feature.bindings).toEqual(
      [path.join(fixture, 'src/app/bindings/activity.server.ts'), path.join(fixture, 'src/app/bindings/activity.web.ts')].sort(),
    );
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toContain('composeActivityServer(app);');
    expect(readFileSync(path.join(fixture, 'src/app/router.ts'), 'utf8')).toContain('...activityWebRoutes,');
    expect(JSON.parse(readFileSync(path.join(fixture, 'package.json'), 'utf8')).dependencies).toHaveProperty('zod');
    expect(readFeatureLineage(fixture, 'activity')).toBeDefined();
    expect(analyzeArchitecture(fixture).healthy).toBe(true);
  });

  it('refuses an application whose Auth lacks what the binding uses', () => {
    const fixture = createApplication(AUTH_BOUNDARY.replace(/^export const isAdmin.*\n/m, ''));

    const result = installOfficialFeature('activity', fixture);

    expect(result.ok).toBe(false);
    expect(existsSync(path.join(fixture, 'src/features/activity'))).toBe(false);
  });
});
