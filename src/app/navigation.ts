import type { RouteMeta, RouteRecordRaw } from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** Slug the session must hold; the router guard and navigation both read it. */
    requiresPermission?: string;
    /** Lists the route in the authenticated shell's navigation. */
    nav?: { label: string };
  }
}

export interface NavigationLink {
  to: string;
  label: string;
}

type Can = (permission: string) => boolean;

export function canEnter(meta: RouteMeta, can: Can): boolean {
  return typeof meta.requiresPermission !== 'string' || can(meta.requiresPermission);
}

/**
 * The shell's links come from the routes Features and bindings declare, in
 * route order, so a composed Feature brings its own link. Only top-level
 * records are listed.
 */
export function navigationLinks(routes: readonly RouteRecordRaw[], can: Can): NavigationLink[] {
  return routes.flatMap((route) => {
    const nav = route.meta?.nav;
    if (!nav || !canEnter(route.meta!, can)) return [];
    return [{ to: route.path, label: nav.label }];
  });
}
