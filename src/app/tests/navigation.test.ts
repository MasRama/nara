import { describe, expect, it } from 'vitest';
import type { RouteRecordRaw } from 'vue-router';
import { canEnter, navigationLinks } from '../navigation';
import { ADMINISTRATOR, type AccessRule } from '../../shared/security/access';

const Page = { render: () => null };

const routes: RouteRecordRaw[] = [
  { path: '/', component: Page },
  { path: '/dashboard', component: Page, meta: { requiresAuth: true, nav: { label: 'Dashboard' } } },
  { path: '/reports', component: Page, meta: { requiresAuth: true, requiresAccess: { permission: 'reports.view' }, nav: { label: 'Reports' } } },
  { path: '/audit', component: Page, meta: { requiresAuth: true, requiresAccess: { permission: 'audit.view' } } },
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

  it('skips routes whose rule the session does not meet', () => {
    const granted = new Set(['audit.view']);
    const allows = (rule: AccessRule) => 'permission' in rule && granted.has(rule.permission);
    expect(navigationLinks(routes, allows).map((link) => link.label)).toEqual([
      'Dashboard',
      'Settings',
    ]);
  });

  it('ignores routes without nav and child routes', () => {
    const labels = navigationLinks(routes, () => true).map((link) => link.label);
    expect(labels).not.toContain('Billing');
    expect(navigationLinks(routes, () => true).some((link) => link.to === '/audit')).toBe(false);
  });

  it('canEnter allows routes without a rule and checks the one they require', () => {
    expect(canEnter({}, () => false)).toBe(true);
    expect(canEnter({ requiresAccess: { permission: 'reports.view' } }, () => false)).toBe(false);
    expect(canEnter({ requiresAccess: ADMINISTRATOR }, (rule) => rule === ADMINISTRATOR)).toBe(true);
  });
});
