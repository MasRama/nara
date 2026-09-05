import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverFeatureIntegrations } from './discover-integrations';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-integrations-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFile(fixture: string, relativePath: string, content: string): void {
  const filePath = path.join(fixture, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeFeature(fixture: string, name: string, files: Record<string, string> = {}): void {
  writeFile(fixture, path.join('src/features', name, 'index.ts'), 'export const feature = true;\n');
  for (const [relativePath, content] of Object.entries(files)) {
    writeFile(fixture, path.join('src/features', name, relativePath), content);
  }
}

describe('application integration discovery', () => {
  it('groups canonical public and web imports with deterministic symbols', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users');
    writeFile(
      fixture,
      'src/app/server.ts',
      `import { userRoutes as routes, resetUsers } from '@/features/users';
import { ignored } from '@/features/users/server/private';
import External from 'external';

app.route('/api/users', routes);
void resetUsers;
void ignored;
void External;
`,
    );
    writeFile(
      fixture,
      'src/app/router.ts',
      `import { UsersPage as Page, type UserProfile } from '@features/users/web';
import AppPage from './pages/AppPage.vue';

createRouter({
  routes: [{ path: '/users', component: Page }],
});`
    );

    const facts = discoverFeatureIntegrations(fixture).users;

    expect(facts.applicationImports).toEqual([
      {
        feature: 'users',
        appFile: 'src/app/router.ts',
        boundary: 'web',
        symbols: ['UserProfile', 'UsersPage'],
      },
      {
        feature: 'users',
        appFile: 'src/app/server.ts',
        boundary: 'public',
        symbols: ['resetUsers', 'userRoutes'],
      },
    ]);
    expect(facts.applicationImports.map((fact) => fact.symbols)).toEqual([
      ['UserProfile', 'UsersPage'],
      ['resetUsers', 'userRoutes'],
    ]);
    expect(facts.serverRoutes).toEqual([]);
    expect(facts.webRoutes).toEqual([]);
  });

  it('detects static Hono mounts and ignores uncertain paths or modules', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users');
    writeFile(
      fixture,
      'src/app/server.ts',
      `import { Hono } from 'hono';
    import { Hono as HonoApp } from 'hono';
    import { userRoutes as routes } from '../features/users';
    import { externalRoutes } from './external-routes';
    const app = new Hono();
    export const application = new HonoApp();
    const custom = customRouter();
    const fake = { route() {} };
    const prefix = '/api/dynamic';

    app.route('/api/users', routes);
    application.route('/api/members', routes);
    custom.route('/api/factory', routes);
    logger.route('/api/logger', routes);
    fake.route('/api/fake', routes);
    app.route(prefix, routes);
    app.route('/api/external', externalRoutes);
    `,
    );

    const facts = discoverFeatureIntegrations(fixture).users;

    expect(facts.serverRoutes).toEqual([
      {
        feature: 'users',
        appFile: 'src/app/server.ts',
        exportName: 'userRoutes',
        mountPath: '/api/members',
      },
      {
        feature: 'users',
        appFile: 'src/app/server.ts',
        exportName: 'userRoutes',
        mountPath: '/api/users',
      },
    ]);
  });
  it('keeps boundary consumers when framework provenance is unknown', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users');
    writeFile(
      fixture,
      'src/app/server.ts',
      `import { userRoutes as routes } from '../features/users';
    const application = customRouter();
    application.route('/api/users', routes);
    `,
    );
    writeFile(
      fixture,
      'src/app/router.ts',
      `import { UsersPage } from '../features/users/web';
    function createRouter(options: unknown) {
      return options;
    }
    createRouter({ routes: [{ path: '/users', component: UsersPage }] });
    `,
    );

    const facts = discoverFeatureIntegrations(fixture).users;

    expect(facts.applicationImports).toEqual([
      {
        feature: 'users',
        appFile: 'src/app/router.ts',
        boundary: 'web',
        symbols: ['UsersPage'],
      },
      {
        feature: 'users',
        appFile: 'src/app/server.ts',
        boundary: 'public',
        symbols: ['userRoutes'],
      },
    ]);
    expect(facts.serverRoutes).toEqual([]);
    expect(facts.webRoutes).toEqual([]);
  });

  it('detects nested Vue routes and only records static Feature components', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users');
    writeFeature(fixture, 'billing');
    writeFile(
      fixture,
      'src/app/router.ts',
      `import { createRouter } from 'vue-router';
    import { ProfilePage as Profile, UsersPage } from '../features/users/web';
    import BillingPage from './pages/BillingPage.vue';
    import AppPage from './pages/AppPage.vue';

    const userChildren = [
      { path: 'profile', name: 'profile', component: Profile },
    ];
    const routes = [
      { path: '/users', children: userChildren },
      { path: '/people', name: 'people', component: UsersPage },
      { path: '/billing', component: BillingPage },
      { path: '/dynamic', component: resolvePage() },
      { path: computedPath, component: AppPage },
      { path: computedParentPath, children: [{ path: 'hidden', component: UsersPage }] },
    ];

    export default createRouter({ history: createWebHistory(), routes });
    `,
    );

    const integrations = discoverFeatureIntegrations(fixture);

    expect(integrations.users.webRoutes).toEqual([
      {
        feature: 'users',
        appFile: 'src/app/router.ts',
        exportName: 'UsersPage',
        path: '/people',
        name: 'people',
      },
      {
        feature: 'users',
        appFile: 'src/app/router.ts',
        exportName: 'ProfilePage',
        path: '/users/profile',
        name: 'profile',
      },
    ]);
    expect(integrations.billing.webRoutes).toEqual([]);
  });

  it('requires Vue Router factory provenance before scanning routes', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users');
    writeFile(
      fixture,
      'src/app/router.ts',
      `import { createRouter as makeRouter } from 'vue-router';
    import { createRouter as otherCreateRouter } from 'other-router';
    import { UsersPage as Page } from '../features/users/web';

    function createRouter(options: unknown) {
      return options;
    }
    const computedPath = getPath();

    makeRouter({
      routes: [
        { path: '/users', name: 'users', component: Page },
        { path: computedPath, component: Page },
        { path: '/dynamic-component', component: resolvePage() },
      ],
    });
    createRouter({ routes: [{ path: '/local', component: Page }] });
    otherCreateRouter({ routes: [{ path: '/other', component: Page }] });
    `,
    );

    const facts = discoverFeatureIntegrations(fixture).users;

    expect(facts.webRoutes).toEqual([
      {
        feature: 'users',
        appFile: 'src/app/router.ts',
        exportName: 'UsersPage',
        path: '/users',
        name: 'users',
      },
    ]);
  });

  it('returns empty deterministic facts when composition roots are missing', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users');
    writeFile(
      fixture,
      'src/app/other.ts',
      `import { userRoutes } from '../features/users';\napp.route('/api/users', userRoutes);\n`,
    );

    expect(discoverFeatureIntegrations(fixture)).toEqual({
      users: { applicationImports: [], serverRoutes: [], webRoutes: [] },
    });
  });
});
