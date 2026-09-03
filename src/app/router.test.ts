import { describe, expect, it } from 'vitest';
import router from './router';

describe('application browser routes', () => {
  it('resolves unknown browser paths to the canonical not-found route', () => {
    expect(router.resolve('/this-route-does-not-exist').name).toBe('not-found');
  });
});
