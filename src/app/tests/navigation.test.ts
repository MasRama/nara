import { describe, expect, it } from 'vitest';
import type { RouteRecordRaw } from 'vue-router';
import { canEnter, navigationLinks } from '../navigation';

const Page = { render: () => null };

const routes: RouteRecordRaw[] = [
  { path: '/', component: Page },
  { path: '/dashboard', component: Page, meta: { requiresAuth: true, nav: { label: 'Dashboard' } } },
  { path: '/reports', component: Page, meta: { requiresAuth: true, requiresPermission: 'reports.view', nav: { label: 'Reports' } } },
  { path: '/audit', component: Page, meta: { requiresAuth: true, requiresPermission: 'audit.view' } },
  {
    path: '/settings',
    component: Page,
    meta: { nav: { label: 'Settings' } },
    children: [{ path: 'billing', component: Page, meta: { nav: { label: 'Billing' } } }],
  },
];

describe('application navigation', () => {
  it('lists routes that opt into navigation, in route order', () => {
    expect(navigationLinks(routes, () => true)).toEqual([
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/reports', label: 'Reports' },
      { to: '/settings', label: 'Settings' },
    ]);
  });

  it('skips routes whose permission is not granted', () => {
    const granted = new Set(['audit.view']);
    expect(navigationLinks(routes, (permission) => granted.has(permission)).map((link) => link.label)).toEqual([
      'Dashboard',
      'Settings',
    ]);
  });

  it('ignores routes without nav and child routes', () => {
    const labels = navigationLinks(routes, () => true).map((link) => link.label);
    expect(labels).not.toContain('Billing');
    expect(navigationLinks(routes, () => true).some((link) => link.to === '/audit')).toBe(false);
  });

  it('canEnter allows routes without a permission and checks the one they require', () => {
    expect(canEnter({}, () => false)).toBe(true);
    expect(canEnter({ requiresPermission: 'reports.view' }, () => false)).toBe(false);
    expect(canEnter({ requiresPermission: 'reports.view' }, (permission) => permission === 'reports.view')).toBe(true);
  });
});
