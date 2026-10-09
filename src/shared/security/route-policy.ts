import type { Context, Hono } from 'hono';

/**
 * What a Feature asks of the application's outer middleware for one of its
 * routes. Paths are relative to the router's mount; `/x/*` also covers `/x`,
 * as Hono's own wildcard does.
 */
export interface RoutePolicy {
  path: string;
  /** Every method when omitted. */
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Counts toward the application's strict per-client limit. */
  sensitive?: boolean;
  /** Request body budget replacing the application default; names one method and exact path. */
  bodyMaxBytes?: number;
}

interface DeclaredPolicy extends RoutePolicy {
  /** Absolute path as declared, for reporting. */
  absolute: string;
  /** Exact path, or the base a wildcard covers. */
  base: string;
  wildcard: boolean;
}

export interface RoutePolicyRegistry {
  isSensitive(context: Context): boolean;
  bodyBudget(context: Context): number | undefined;
  declared(): Array<{ method?: string; path: string }>;
}

// Keyed by application instance: the global middleware is registered before
// any Feature router is mounted, so it reads what the mounts declared at
// request time. A new instance (a test, a dev reload) starts empty.
const registries = new WeakMap<Hono, DeclaredPolicy[]>();

function policiesOf(app: Hono): DeclaredPolicy[] {
  let policies = registries.get(app);
  if (!policies) {
    policies = [];
    registries.set(app, policies);
  }
  return policies;
}

/** Declare a Feature router's policies where it is mounted, next to `app.route(mountPath, ...)`. */
export function declareRoutePolicies(app: Hono, mountPath: string, policies: readonly RoutePolicy[]): void {
  const existing = policiesOf(app);
  const incoming: DeclaredPolicy[] = [];
  for (const policy of policies) {
    if (!policy.path.startsWith('/')) throw new Error(`Route policy path "${policy.path}" must start with "/".`);
    const absolute = `${mountPath.replace(/\/$/, '')}${policy.path === '/' ? '' : policy.path}` || '/';
    const wildcard = absolute.endsWith('/*');
    const base = wildcard ? absolute.slice(0, -2) : absolute;
    if (policy.bodyMaxBytes !== undefined) {
      if (!policy.method || wildcard) {
        throw new Error(`Body budget for "${absolute}" must name a method and an exact path.`);
      }
      const taken = [...existing, ...incoming].some(
        (other) => other.bodyMaxBytes !== undefined && other.method === policy.method && other.absolute === absolute,
      );
      if (taken) throw new Error(`${policy.method} ${absolute} already has a body budget.`);
    }
    incoming.push({ ...policy, absolute, base, wildcard });
  }
  existing.push(...incoming);
}

function matches(policy: DeclaredPolicy, context: Context): boolean {
  if (policy.method && policy.method !== context.req.method.toUpperCase()) return false;
  // Hono routes on the decoded path, so an encoded spelling reaches the same handler.
  const path = context.req.path;
  return path === policy.base || (policy.wildcard && path.startsWith(`${policy.base}/`));
}

export function routePolicyFor(app: Hono): RoutePolicyRegistry {
  const policies = policiesOf(app);
  return {
    isSensitive: (context) => policies.some((policy) => policy.sensitive === true && matches(policy, context)),
    bodyBudget: (context) =>
      policies.find((policy) => policy.bodyMaxBytes !== undefined && matches(policy, context))?.bodyMaxBytes,
    declared: () =>
      policies.map((policy) => (policy.method ? { method: policy.method, path: policy.absolute } : { path: policy.absolute })),
  };
}
