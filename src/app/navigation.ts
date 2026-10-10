import type { RouteMeta, RouteRecordRaw } from 'vue-router';
import type { AccessRule } from '../shared/security/access';

declare module 'vue-router' {
  interface RouteMeta {
    /** The rule the session must meet, the one the page's API enforces; the router guard and navigation both read it. */
    requiresAccess?: AccessRule;
    /** Lists the route in the authenticated shell's navigation. */
    nav?: { label: string };
  }
}

export interface NavigationLink {
  to: string;
  label: string;
}

type Allows = (rule: AccessRule) => boolean;

export function canEnter(meta: RouteMeta, allows: Allows): boolean {
  return meta.requiresAccess === undefined || allows(meta.requiresAccess);
}

/**
 * The shell's links come from the routes Features and bindings declare, in
 * route order, so a composed Feature brings its own link. Only top-level
 * records are listed.
 */
export function navigationLinks(routes: readonly RouteRecordRaw[], allows: Allows): NavigationLink[] {
  return routes.flatMap((route) => {
    const nav = route.meta?.nav;
    if (!nav || !canEnter(route.meta!, allows)) return [];
    return [{ to: route.path, label: nav.label }];
  });
}
