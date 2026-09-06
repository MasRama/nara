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
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-assembly-proof-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFiles(root: string, files: Record<string, string>): void {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, ...relative.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

const BILLING_INDEX = `import { Hono } from 'hono';

export const billingRoutes = new Hono().get('/', (context) => context.text('billing'));
`;

const BILLING_WEB_INDEX = `export const BillingPage = { template: '<div>billing</div>' };
`;

function featureShell(root: string): void {
  writeFiles(root, {
    'src/features/billing/index.ts': BILLING_INDEX,
    'src/features/billing/web/index.ts': BILLING_WEB_INDEX,
  });
}

const HONO_SERVER = `import { Hono } from 'hono';

export const app = new Hono();
`;

const ROUTER_SHELL = `import { createRouter, createWebHistory } from 'vue-router';
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

describe('server assembly provenance', () => {
  it('proves an active binding imported and called with the Hono instance', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/server.ts': `${HONO_SERVER}
import composeBillingServer from './bindings/billing.server';

composeBillingServer(app);
`,
      'src/app/bindings/billing.server.ts': `import type { Hono } from 'hono';
import { billingRoutes } from '../../features/billing';

export default function composeBillingServer(app: Hono): void {
  app.route('/billing', billingRoutes);
}
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.applicationImports).toEqual([
      { feature: 'billing', appFile: 'src/app/bindings/billing.server.ts', boundary: 'public', symbols: ['billingRoutes'] },
    ]);
    expect(facts.serverRoutes).toEqual([
      { feature: 'billing', appFile: 'src/app/server.ts', exportName: 'billingRoutes', mountPath: '/billing' },
    ]);
  });

  it('proves aliased binding imports', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/server.ts': `${HONO_SERVER}
import mountBilling from './bindings/billing.server';

mountBilling(app);
`,
      'src/app/bindings/billing.server.ts': `import type { Hono } from 'hono';
import { billingRoutes } from '../../features/billing';

export default function composeBillingServer(app: Hono): void {
  app.route('/billing', billingRoutes);
}
`,
    });

    const aliased = discoverFeatureIntegrations(root).billing;

    expect(aliased.applicationImports).toEqual([
      { feature: 'billing', appFile: 'src/app/bindings/billing.server.ts', boundary: 'public', symbols: ['billingRoutes'] },
    ]);
    expect(aliased.serverRoutes).toEqual([
      { feature: 'billing', appFile: 'src/app/server.ts', exportName: 'billingRoutes', mountPath: '/billing' },
    ]);
  });

  it('ignores an arbitrary local function with the same call shape', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/server.ts': `${HONO_SERVER}
function composeBillingServer(app: { route(path: string, routes: unknown): void }): void {
  void app;
}

composeBillingServer(app);
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.applicationImports).toEqual([]);
    expect(facts.serverRoutes).toEqual([]);
  });

  it('ignores a binding called with a non-Hono object', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/server.ts': `import { Hono } from 'hono';
import composeBillingServer from './bindings/billing.server';

export const app = new Hono();
const notHono = {};

composeBillingServer(notHono);
`,
      'src/app/bindings/billing.server.ts': `import type { Hono } from 'hono';
import { billingRoutes } from '../../features/billing';

export default function composeBillingServer(app: Hono): void {
  app.route('/billing', billingRoutes);
}
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.serverRoutes).toEqual([]);
  });

  it('ignores an orphan binding that is never activated', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/server.ts': HONO_SERVER,
      'src/app/bindings/billing.server.ts': `import type { Hono } from 'hono';
import { billingRoutes } from '../../features/billing';

export default function composeBillingServer(app: Hono): void {
  app.route('/billing', billingRoutes);
}
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.applicationImports).toEqual([]);
    expect(facts.serverRoutes).toEqual([]);
  });

  it('stays conservative on dynamic mount paths', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/server.ts': `${HONO_SERVER}
import composeBillingServer from './bindings/billing.server';

composeBillingServer(app);
`,
      'src/app/bindings/billing.server.ts': `import type { Hono } from 'hono';
import { billingRoutes } from '../../features/billing';

export default function composeBillingServer(app: Hono, prefix: string): void {
  app.route(prefix, billingRoutes);
}
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.applicationImports).toEqual([
      { feature: 'billing', appFile: 'src/app/bindings/billing.server.ts', boundary: 'public', symbols: ['billingRoutes'] },
    ]);
    expect(facts.serverRoutes).toEqual([]);
  });
});

describe('web assembly provenance', () => {
  it('proves a default route-array binding spread into the router', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/router.ts': `import { createRouter, createWebHistory } from 'vue-router';
import billingWebRoutes from './bindings/billing.web';
import HomePage from './pages/HomePage.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    ...billingWebRoutes,
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: HomePage,
    },
  ],
});
`,
      'src/app/bindings/billing.web.ts': `import type { RouteRecordRaw } from 'vue-router';
import { BillingPage } from '../../features/billing/web';

export default [
  {
    path: '/billing',
    name: 'billing',
    component: BillingPage,
  },
] satisfies RouteRecordRaw[];
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.applicationImports).toEqual([
      { feature: 'billing', appFile: 'src/app/bindings/billing.web.ts', boundary: 'web', symbols: ['BillingPage'] },
    ]);
    expect(facts.webRoutes).toEqual([
      { feature: 'billing', appFile: 'src/app/router.ts', exportName: 'BillingPage', path: '/billing', name: 'billing' },
    ]);
  });

  it('ignores an orphan web binding', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/router.ts': ROUTER_SHELL,
      'src/app/bindings/billing.web.ts': `import { BillingPage } from '../../features/billing/web';

export default [
  {
    path: '/billing',
    name: 'billing',
    component: BillingPage,
  },
];
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.applicationImports).toEqual([]);
    expect(facts.webRoutes).toEqual([]);
  });

  it('ignores an unrelated createRouter factory', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/router.ts': `import billingWebRoutes from './bindings/billing.web';
import HomePage from './pages/HomePage.vue';

function createRouter(options: { routes: unknown[] }): unknown {
  return options;
}

export default createRouter({ routes: [...billingWebRoutes] });
`,
      'src/app/bindings/billing.web.ts': `import { BillingPage } from '../../features/billing/web';

export default [
  {
    path: '/billing',
    name: 'billing',
    component: BillingPage,
  },
];
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.webRoutes).toEqual([]);
  });

  it('ignores unrelated array spreads', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/router.ts': `import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

const extraRoutes = [
  {
    path: '/extra',
    name: 'extra',
    component: HomePage,
  },
];

export default createRouter({
  history: createWebHistory(),
  routes: [
    ...extraRoutes,
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: HomePage,
    },
  ],
});
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.applicationImports).toEqual([]);
    expect(facts.webRoutes).toEqual([]);
  });

  it('keeps nested binding records correct', () => {
    const root = createFixture();
    featureShell(root);
    writeFiles(root, {
      'src/app/router.ts': `import { createRouter, createWebHistory } from 'vue-router';
import billingWebRoutes from './bindings/billing.web';
import HomePage from './pages/HomePage.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    ...billingWebRoutes,
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: HomePage,
    },
  ],
});
`,
      'src/app/bindings/billing.web.ts': `import { BillingPage } from '../../features/billing/web';

export default [
  {
    path: '/billing',
    name: 'billing',
    component: BillingPage,
    children: [
      {
        path: 'history',
        name: 'billing-history',
        component: BillingPage,
      },
    ],
  },
];
`,
    });

    const facts = discoverFeatureIntegrations(root).billing;

    expect(facts.webRoutes).toEqual([
      { feature: 'billing', appFile: 'src/app/router.ts', exportName: 'BillingPage', path: '/billing', name: 'billing' },
      {
        feature: 'billing',
        appFile: 'src/app/router.ts',
        exportName: 'BillingPage',
        path: '/billing/history',
        name: 'billing-history',
      },
    ]);
  });
});
