import { describe, expect, it } from 'vitest';
import {
  camelCaseFeatureName,
  classifyTemplateSpecifier,
  composeServerRoot,
  composeWebRoot,
  pascalCaseFeatureName,
  serverComposeLocalName,
  validateServerAssemblyTemplate,
  validateWebAssemblyTemplate,
  webRoutesLocalName,
} from './assembly';

const SERVER_ROOT = `import { Hono } from 'hono';
import { userRoutes } from '../features/users';

export const app = new Hono();

app.route('/api/users', userRoutes);
`;

const WEB_ROOT = `import { createRouter, createWebHistory } from 'vue-router';
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

describe('assembly names', () => {
  it('derives deterministic binding locals from the feature name', () => {
    expect(pascalCaseFeatureName('health')).toBe('Health');
    expect(pascalCaseFeatureName('access-log')).toBe('AccessLog');
    expect(camelCaseFeatureName('access-log')).toBe('accessLog');
    expect(serverComposeLocalName('health')).toBe('composeHealthServer');
    expect(webRoutesLocalName('access-log')).toBe('accessLogWebRoutes');
  });

  it('classifies destination-relative template specifiers', () => {
    expect(classifyTemplateSpecifier('../../features/health', 'health')).toBe('public');
    expect(classifyTemplateSpecifier('../../features/health/index.ts', 'health')).toBe('public');
    expect(classifyTemplateSpecifier('../../features/health/web', 'health')).toBe('web');
    expect(classifyTemplateSpecifier('../../features/health/server/routes.ts', 'health')).toBeUndefined();
    expect(classifyTemplateSpecifier('../../features/other', 'health')).toBeUndefined();
    expect(classifyTemplateSpecifier('hono', 'health')).toBeUndefined();
  });
});

describe('server assembly templates', () => {
  const valid = `import type { Hono } from 'hono';
import { healthRoutes } from '../../features/health';

export default function composeHealthServer(app: Hono): void {
  app.route('/health', healthRoutes);
}
`;

  it('accepts the canonical composition function', () => {
    expect(validateServerAssemblyTemplate(valid, 'health')).toBeUndefined();
  });

  it('accepts an arrow-function default export', () => {
    const source = `import { healthRoutes } from '../../features/health';
import type { Hono } from 'hono';

export default (app: Hono): void => {
  app.route('/health', healthRoutes);
};
`;
    expect(validateServerAssemblyTemplate(source, 'health')).toBeUndefined();
  });

  it('rejects templates without a default-exported function', () => {
    const source = `import { healthRoutes } from '../../features/health';

export function compose(app: unknown): void {
  void app;
}
`;
    expect(validateServerAssemblyTemplate(source, 'health')).toContain('default-export');
  });

  it('rejects templates that do not import the feature boundary', () => {
    const source = `import type { Hono } from 'hono';

export default function compose(app: Hono): void {
  app.route('/health', app);
}
`;
    expect(validateServerAssemblyTemplate(source, 'health')).toContain('"health" public boundary');
  });

  it('rejects templates without a static route mount', () => {
    const source = `import type { Hono } from 'hono';
import { healthRoutes } from '../../features/health';

export default function compose(app: Hono, prefix: string): void {
  app.route(prefix, healthRoutes);
}
`;
    expect(validateServerAssemblyTemplate(source, 'health')).toContain('.route()');
  });

  it('rejects unparseable templates', () => {
    expect(validateServerAssemblyTemplate('export default function ( {', 'health')).toContain('does not parse');
  });
});

describe('web assembly templates', () => {
  const valid = `import type { RouteRecordRaw } from 'vue-router';
import { GalleryPage } from '../../features/gallery/web';

export default [
  {
    path: '/gallery',
    name: 'gallery',
    component: GalleryPage,
  },
] satisfies RouteRecordRaw[];
`;

  it('accepts the canonical route array', () => {
    expect(validateWebAssemblyTemplate(valid, 'gallery')).toBeUndefined();
  });

  it('rejects templates without a web boundary import', () => {
    const source = `export default [{ path: '/gallery', name: 'gallery', component: {} }];
`;
    expect(validateWebAssemblyTemplate(source, 'gallery')).toContain('web boundary');
  });

  it('rejects templates without a static path record', () => {
    const source = `import { GalleryPage } from '../../features/gallery/web';

export default [{ name: 'gallery', component: GalleryPage }];
`;
    expect(validateWebAssemblyTemplate(source, 'gallery')).toContain('static path');
  });
});

describe('composeServerRoot', () => {
  it('adds one import and mounts after the last route', () => {
    const composed = composeServerRoot(SERVER_ROOT, 'health');

    expect(composed.localName).toBe('composeHealthServer');
    expect(composed.honoInstance).toBe('app');
    expect(composed.content).toContain(`import composeHealthServer from './bindings/health.server';\n`);
    const routeIndex = composed.content.indexOf(`app.route('/api/users', userRoutes);`);
    const composeIndex = composed.content.indexOf('composeHealthServer(app);');
    expect(routeIndex).toBeGreaterThan(-1);
    expect(composeIndex).toBeGreaterThan(routeIndex);
    expect(composed.content).toContain('app.route(');
  });

  it('mounts after the Hono instance when no route exists yet', () => {
    const source = `import { Hono } from 'hono';\n\nexport const app = new Hono();\n`;
    const composed = composeServerRoot(source, 'health');

    const instanceIndex = composed.content.indexOf('export const app = new Hono();');
    const composeIndex = composed.content.indexOf('composeHealthServer(app);');
    expect(composeIndex).toBeGreaterThan(instanceIndex);
  });

  it('is idempotent', () => {
    const first = composeServerRoot(SERVER_ROOT, 'health');
    const second = composeServerRoot(first.content, 'health');

    expect(second.content).toBe(first.content);
  });

  it('reuses an existing binding import instead of duplicating it', () => {
    const source = `import { Hono } from 'hono';
import mountHealth from './bindings/health.server';

export const app = new Hono();
`;
    const composed = composeServerRoot(source, 'health');

    expect(composed.localName).toBe('mountHealth');
    expect(composed.content).toContain('mountHealth(app);');
    expect(composed.content.match(/from '\.\/bindings\/health\.server'/g)).toHaveLength(1);
  });

  it('fails when no Hono instance is provable', () => {
    expect(() => composeServerRoot(`export const app = {};\n`, 'health')).toThrow(
      'does not prove a Hono application instance',
    );
  });

  it('fails when the deterministic local name is taken', () => {
    const source = `import { Hono } from 'hono';

export const app = new Hono();
const composeHealthServer = 1;
`;
    expect(() => composeServerRoot(source, 'health')).toThrow('already declared');
  });
});

describe('composeWebRoot', () => {
  it('adds one import and spreads before the catch-all record', () => {
    const composed = composeWebRoot(WEB_ROOT, 'gallery');

    expect(composed.localName).toBe('galleryWebRoutes');
    expect(composed.content).toContain(`import galleryWebRoutes from './bindings/gallery.web';\n`);
    const spreadIndex = composed.content.indexOf('...galleryWebRoutes,');
    const catchAllIndex = composed.content.indexOf('/:pathMatch(.*)*');
    expect(spreadIndex).toBeGreaterThan(-1);
    expect(catchAllIndex).toBeGreaterThan(-1);
    expect(spreadIndex).toBeLessThan(catchAllIndex);
  });

  it('appends when no catch-all record exists', () => {
    const source = `import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
  ],
});
`;
    const composed = composeWebRoot(source, 'gallery');

    expect(composed.content).toContain('...galleryWebRoutes,');
  });

  it('follows a routes identifier to its array', () => {
    const source = `import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
];

export default createRouter({ history: createWebHistory(), routes });
`;
    const composed = composeWebRoot(source, 'gallery');

    expect(composed.content).toContain('...galleryWebRoutes,');
  });

  it('is idempotent', () => {
    const first = composeWebRoot(WEB_ROOT, 'gallery');
    const second = composeWebRoot(first.content, 'gallery');

    expect(second.content).toBe(first.content);
  });

  it('fails when no vue-router factory is provable', () => {
    const source = `function createRouter(options: unknown): unknown {
  return options;
}

export default createRouter({ routes: [] });
`;
    expect(() => composeWebRoot(source, 'gallery')).toThrow('does not import createRouter');
  });

  it('fails when no static route array is provable', () => {
    const source = `import { createRouter, createWebHistory } from 'vue-router';

declare const routes: unknown[];

export default createRouter({ history: createWebHistory(), routes });
`;
    expect(() => composeWebRoot(source, 'gallery')).toThrow('static route array');
  });
});
