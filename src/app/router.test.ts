import { describe, expect, it } from 'vitest';
import router, { appRoutes, appScrollBehavior } from './router';

describe('application browser routes', () => {
  it('keeps declared route paths and names unique before Vue Router normalization', () => {
    const paths = appRoutes.map((route) => route.path);
    const names = appRoutes.flatMap((route) => (typeof route.name === 'string' ? [route.name] : []));

    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('resolves unknown browser paths to the canonical not-found route', () => {
    expect(router.resolve('/this-route-does-not-exist').name).toBe('not-found');
  });

  it('scrolls hash navigation to the requested section and restores browser positions', () => {
    const from = router.resolve('/dashboard') as unknown as Parameters<typeof appScrollBehavior>[1];
    const to = router.resolve('/profile#security') as unknown as Parameters<typeof appScrollBehavior>[0];

    expect(appScrollBehavior(to, from, null)).toEqual({ el: '#security' });
    expect(appScrollBehavior(to, from, { left: 3, top: 7 })).toEqual({ left: 3, top: 7 });
  });
});
