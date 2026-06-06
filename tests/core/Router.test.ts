/**
 * Tests for NaraRouter
 * 
 * Validates route registration, middleware chaining,
 * route groups, mounting, and method coverage.
 */

import { describe, it, expect, vi } from 'vitest';
import { NaraRouter, createRouter } from '../../app/core/Router';

/**
 * Helper: extract the underlying HyperExpress router from NaraRouter
 * We use getRouter() to access it for verification.
 */
function getInternalRouter(router: NaraRouter) {
  return router.getRouter();
}

describe('NaraRouter', () => {
  describe('createRouter', () => {
    it('creates a new NaraRouter instance', () => {
      const router = createRouter();
      expect(router).toBeInstanceOf(NaraRouter);
    });

    it('has an underlying HyperExpress router', () => {
      const router = createRouter();
      expect(getInternalRouter(router)).toBeDefined();
    });
  });

  describe('route registration', () => {
    it('registers GET routes', () => {
      const router = createRouter();
      const handler = vi.fn();

      const result = router.get('/test', handler);

      // Should return this for chaining
      expect(result).toBe(router);
    });

    it('registers POST routes', () => {
      const router = createRouter();
      const handler = vi.fn();

      const result = router.post('/test', handler);
      expect(result).toBe(router);
    });

    it('registers PUT routes', () => {
      const router = createRouter();
      const result = router.put('/test', vi.fn());
      expect(result).toBe(router);
    });

    it('registers PATCH routes', () => {
      const router = createRouter();
      const result = router.patch('/test', vi.fn());
      expect(result).toBe(router);
    });

    it('registers DELETE routes', () => {
      const router = createRouter();
      const result = router.delete('/test', vi.fn());
      expect(result).toBe(router);
    });

    it('registers OPTIONS routes', () => {
      const router = createRouter();
      const result = router.options('/test', vi.fn());
      expect(result).toBe(router);
    });

    it('registers HEAD routes', () => {
      const router = createRouter();
      const result = router.head('/test', vi.fn());
      expect(result).toBe(router);
    });

    it('registers ANY routes', () => {
      const router = createRouter();
      const result = router.any('/webhook', vi.fn());
      expect(result).toBe(router);
    });
  });

  describe('middleware support', () => {
    it('registers routes with single middleware', () => {
      const router = createRouter();
      const middleware = vi.fn();
      const handler = vi.fn();

      const result = router.get('/protected', middleware, handler);
      expect(result).toBe(router);
    });

    it('registers routes with middleware array', () => {
      const router = createRouter();
      const m1 = vi.fn();
      const m2 = vi.fn();
      const handler = vi.fn();

      const result = router.post('/admin', [m1, m2], handler);
      expect(result).toBe(router);
    });

    it('registers POST routes with middlewares', () => {
      const router = createRouter();
      const result = router.post('/test', [vi.fn()], vi.fn());
      expect(result).toBe(router);
    });

    it('registers PUT routes with middlewares', () => {
      const router = createRouter();
      const result = router.put('/test', [vi.fn()], vi.fn());
      expect(result).toBe(router);
    });

    it('registers PATCH routes with middlewares', () => {
      const router = createRouter();
      const result = router.patch('/test', [vi.fn()], vi.fn());
      expect(result).toBe(router);
    });

    it('registers DELETE routes with middlewares', () => {
      const router = createRouter();
      const result = router.delete('/test', [vi.fn()], vi.fn());
      expect(result).toBe(router);
    });

    it('registers ANY routes with middlewares', () => {
      const router = createRouter();
      const result = router.any('/test', [vi.fn()], vi.fn());
      expect(result).toBe(router);
    });
  });

  describe('chaining', () => {
    it('supports fluent chaining of multiple routes', () => {
      const router = createRouter();
      const handler = vi.fn();

      router
        .get('/users', handler)
        .post('/users', handler)
        .put('/users/:id', handler)
        .delete('/users/:id', handler);

      // No errors thrown = success
      expect(router).toBeInstanceOf(NaraRouter);
    });
  });

  describe('use (global middleware)', () => {
    it('applies middleware to all routes', () => {
      const router = createRouter();
      const middleware = vi.fn();

      const result = router.use(middleware);
      expect(result).toBe(router);
    });

    it('applies middleware to a path prefix', () => {
      const router = createRouter();
      const middleware = vi.fn();

      const result = router.use('/api', middleware);
      expect(result).toBe(router);
    });
  });

  describe('mount (sub-router)', () => {
    it('mounts a sub-router at a path', () => {
      const main = createRouter();
      const api = createRouter();

      api.get('/users', vi.fn());

      const result = main.mount('/api', api);
      expect(result).toBe(main);
    });
  });

  describe('group', () => {
    it('creates a route group with prefix', () => {
      const router = createRouter();

      const result = router.group('/api', (r) => {
        r.get('/users', vi.fn());
        r.post('/users', vi.fn());
      });

      expect(result).toBe(router);
    });

    it('creates a route group with prefix and middlewares', () => {
      const router = createRouter();
      const authMiddleware = vi.fn();

      const result = router.group('/api', [authMiddleware], (r) => {
        r.get('/profile', vi.fn());
        r.put('/profile', vi.fn());
      });

      expect(result).toBe(router);
    });

    it('supports nested groups', () => {
      const router = createRouter();

      router.group('/api', (r) => {
        r.group('/v1', (r2) => {
          r2.get('/users', vi.fn());
        });
        r.group('/v2', (r2) => {
          r2.get('/users', vi.fn());
        });
      });

      // No errors thrown = success
      expect(router).toBeInstanceOf(NaraRouter);
    });
  });

  describe('getRouter', () => {
    it('returns the underlying HyperExpress router', () => {
      const router = createRouter();
      const internal = router.getRouter();

      expect(internal).toBeDefined();
      expect(typeof internal.get).toBe('function');
      expect(typeof internal.post).toBe('function');
    });
  });
});
