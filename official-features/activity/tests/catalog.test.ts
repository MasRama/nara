import { describe, expect, it } from 'vitest';
import { createActivityCatalog } from '../server/catalog';

describe('activity catalog', () => {
  it('lists declared actions under their full slug, in declaration order', () => {
    const catalog = createActivityCatalog();
    catalog.declare('billing', [
      { action: 'invoice-sent', label: 'Invoice sent', kind: 'create' },
      { action: 'refunded', label: 'Payment refunded', kind: 'update' },
    ]);
    catalog.declare('auth', [{ action: 'login', label: 'Signed in', kind: 'access' }]);

    expect(catalog.list()).toEqual([
      { action: 'billing.invoice-sent', label: 'Invoice sent', kind: 'create' },
      { action: 'billing.refunded', label: 'Payment refunded', kind: 'update' },
      { action: 'auth.login', label: 'Signed in', kind: 'access' },
    ]);
  });

  it('accepts an identical declaration again, as a dev server reload sends it', () => {
    const catalog = createActivityCatalog();
    const declarations = [{ action: 'login', label: 'Signed in', kind: 'access' }] as const;
    catalog.declare('auth', declarations);
    catalog.declare('auth', declarations);

    expect(catalog.list()).toHaveLength(1);
  });

  it('refuses one action declared with two labels or kinds, keeping the first', () => {
    const catalog = createActivityCatalog();
    catalog.declare('auth', [{ action: 'login', label: 'Signed in', kind: 'access' }]);

    expect(() => catalog.declare('auth', [{ action: 'login', label: 'Logged in', kind: 'access' }])).toThrow(/declared twice/);
    expect(() => catalog.declare('auth', [{ action: 'login', label: 'Signed in', kind: 'update' }])).toThrow(/declared twice/);
    expect(catalog.list()).toEqual([{ action: 'auth.login', label: 'Signed in', kind: 'access' }]);
  });

  it('refuses slugs that are not lowercase kebab-case, declaring none of the batch', () => {
    const catalog = createActivityCatalog();

    expect(() =>
      catalog.declare('billing', [
        { action: 'sent', label: 'Sent', kind: 'create' },
        { action: 'Refunded', label: 'Refunded', kind: 'update' },
      ]),
    ).toThrow(/lowercase kebab-case/);
    expect(() => catalog.declare('Billing', [{ action: 'sent', label: 'Sent', kind: 'create' }])).toThrow(/lowercase kebab-case/);
    expect(catalog.list()).toEqual([]);
  });
});
