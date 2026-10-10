import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { compress } from 'hono/compress';
import { Hono } from 'hono';
import { MAINTENANCE, env } from '../shared/config';
import {
  apiBodyLimit,
  assertApiRoutesDeclareAccess,
  createRateLimiter,
  csrfProtection,
  declareRoutePolicies,
  routePolicyFor,
  securityHeaders,
} from '../shared/security';
import { Logger } from '../shared/logging';
import { closeEventStreams, createEventStream, EVENTS_PATH } from '../shared/realtime';
import { handleError } from './error-handler';
import { requestId, requestLifecycleLog } from './observability';
import {
  AUTH_ACTIVITY,
  AUTH_MAINTENANCE,
  AUTH_ROUTE_POLICIES,
  createAuthRoutes,
  createAccessRoutes,
  liveListener,
  passwordChangeGate,
  resetLoginThrottle,
  ROLES_ACTIVITY,
  syncDeclaredPermissions,
} from '../features/auth';
import {
  declareMaintenance,
  discoverMigrations,
  getDatabase,
  migrate,
  optimizeDatabase,
  outstandingMigrations,
  startMaintenance,
  type MaintenanceHandle,
  type MigrationFile,
} from '../shared/database';
import composeUsersServer from './bindings/users.server';
import composeActivityServer, { createActivityRecorder } from './bindings/activity.server';
import { healthRoutes } from '../../official-features/health';

const frontendBuildDirectory = resolve(process.cwd(), 'build', 'client');
const frontendIndex = join(frontendBuildDirectory, 'index.html');
const frontendBuildAvailable = existsSync(frontendIndex);

interface RequestPath {
  pathname: string;
  unsafe: boolean;
}

function requestPath(context: { req: { url: string } }): RequestPath {
  const rawPathname = new URL(context.req.url).pathname;
  try {
    const pathname = decodeURIComponent(rawPathname);
    return {
      pathname,
      unsafe:
        pathname.includes('\u0000') ||
        pathname.includes('\\') ||
        pathname.includes('//') ||
        /(?:^|\/)\.{1,2}(?:\/|$)/.test(pathname),
    };
  } catch {
    return { pathname: rawPathname, unsafe: true };
  }
}

function isReservedPath(pathname: string): boolean {
  return ['/api', '/health', '/ready'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isStaticRequest(pathname: string): boolean {
  if (
    pathname === '/assets' ||
    pathname.startsWith('/assets/') ||
    pathname === '/landing' ||
    pathname.startsWith('/landing/') ||
    pathname === '/nara.png'
  ) {
    return true;
  }

  const filename = pathname.slice(pathname.lastIndexOf('/') + 1);
  return filename.includes('.');
}

function cacheControl(pathname: string): string {
  if (pathname === '/' || pathname === '/index.html') return 'no-cache';
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

const staticHandler = frontendBuildAvailable
  ? serveStatic({ root: frontendBuildDirectory })
  : undefined;
const spaHandler = frontendBuildAvailable
  ? serveStatic({ root: frontendBuildDirectory, path: 'index.html' })
  : undefined;

export const app = new Hono();
// Feature routers declare their sensitive routes and body budgets where they
// are mounted; the middleware below reads those declarations per request.
const routePolicy = routePolicyFor(app);

const isProductionServer = env.NODE_ENV === 'production';

// The decoded path Hono routes on: /%61pi/... reaches the same handlers.
function isApiRequest(context: { req: { path: string } }): boolean {
  return context.req.path.startsWith('/api/');
}

// Auth-specific lockout lives inside the Auth Feature; everything here applies
// uniformly. Cheap request rejection runs before any body streaming so rate-limited or CSRF-invalid
// callers cannot make the server inspect up to the full request-body budget.
const globalRateLimiter = createRateLimiter({
  maxRequests: env.RATE_LIMIT_MAX,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  name: 'global',
  skip: (context) => !isApiRequest(context),
});

// One shared bucket for every route a Feature declares sensitive.
const sensitiveRateLimiter = createRateLimiter({
  maxRequests: env.AUTH_RATE_LIMIT_MAX,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  name: 'sensitive',
  skip: (context) => !routePolicy.isSensitive(context),
});

/** Deterministic test reset: clears limiter buckets and login lockout state. */
export function resetSecurityState(): void {
  globalRateLimiter.reset();
  sensitiveRateLimiter.reset();
  resetLoginThrottle();
}

app.onError(handleError);

// Request lifecycle runs outermost so the request ID is stashed before any
// security middleware can reject (401/403/404/413/429 all carry it) and the
// completion event covers the full pipeline. Health/readiness
// keep IDs but stay out of normal logs. Compression follows: it only touches
// compressible types above its threshold and never alters security headers.
app.use('*', requestId());
app.use('*', requestLifecycleLog());
app.use('*', securityHeaders({ isProduction: isProductionServer }));
app.use('*', compress());

app.use('*', globalRateLimiter.middleware);
app.use('*', sensitiveRateLimiter.middleware);
app.use('*', csrfProtection({ isProduction: isProductionServer }));
// Auth decides which of its own routes stay reachable; the prefix matches its mount below.
app.use('/api/*', passwordChangeGate('/api/auth'));
// Every state-changing /api/* request is bounded by MAX_JSON_BODY_BYTES
// regardless of declared Content-Type, unless its route declared a budget.
app.use('*', apiBodyLimit({ jsonMaxBytes: env.MAX_JSON_BODY_BYTES, routeBudget: routePolicy.bodyBudget }));

app.route('/health', healthRoutes);
// Feature migration files do not change while the process runs, so they are
// discovered once; each probe is then a single read-only ledger query.
let expectedMigrations: MigrationFile[] | undefined;
let lastReadinessProblem: string | undefined;

function reportReadiness(problem: string | undefined, data?: Record<string, unknown>): void {
  // Probes repeat every few seconds; log only when the reason changes.
  if (problem !== undefined && problem !== lastReadinessProblem) Logger.warn('Database not ready', data);
  lastReadinessProblem = problem;
}

/**
 * Ready when every Feature's migrations are recorded with matching checksums.
 * A connection-level SELECT 1 can succeed on an unmigrated database; the
 * expected set comes from the Feature migration directories, so a new Feature
 * or migration is covered without editing this file.
 */
export function databaseReady(database: ReturnType<typeof getDatabase> = getDatabase()): boolean {
  try {
    expectedMigrations ??= discoverMigrations();
    const outstanding = outstandingMigrations(database, expectedMigrations).map((migration) => ({
      feature: migration.feature,
      migration: migration.name,
    }));
    if (outstanding.length === 0) {
      reportReadiness(undefined);
      return true;
    }
    reportReadiness(JSON.stringify(outstanding), { outstanding });
    return false;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    reportReadiness(`error:${err.message}`, { err });
    return false;
  }
}

app.get('/ready', (context) => {
  return databaseReady()
    ? context.json({ status: 'ok' })
    : context.json({ status: 'error' }, 503);
});

if (staticHandler) {
  app.use('*', async (context, next) => {
    const requested = requestPath(context);
    if (requested.unsafe) {
      context.header('Cache-Control', 'no-store');
      return context.notFound();
    }
    if (isReservedPath(requested.pathname)) return next();
    context.header('Cache-Control', cacheControl(requested.pathname));
    return staticHandler(context, next);
  });
}

declareRoutePolicies(app, '/api/auth', AUTH_ROUTE_POLICIES);
declareMaintenance('auth', AUTH_MAINTENANCE);
// Auth and Users declare what they report; Activity records it best-effort.
const activity = createActivityRecorder((error) => {
  Logger.error('Failed to record application activity', error);
});
app.route('/api/auth', createAuthRoutes(activity.declare('auth', AUTH_ACTIVITY)));
app.route('/api/roles', createAccessRoutes(activity.declare('roles', ROLES_ACTIVITY)));
composeUsersServer(app, { activity });
composeActivityServer(app);
// Live updates for signed-in browsers; Auth decides who is listening.
app.get(EVENTS_PATH, createEventStream({ resolve: liveListener }));

app.get('*', async (context, next) => {
  const requested = requestPath(context);
  if (requested.unsafe || isReservedPath(requested.pathname)) {
    context.header('Cache-Control', 'no-store');
    return context.notFound();
  }
  if (isStaticRequest(requested.pathname)) {
    context.header('Cache-Control', 'no-store');
    return context.notFound();
  }
  if (!spaHandler) {
    return context.text(
      'Production frontend build is unavailable. Run npm run build before npm start.',
      503,
    );
  }
  context.header('Cache-Control', 'no-cache');
  return spaHandler(context, next);
});

function ensureProductionFrontend(): void {
  if (env.NODE_ENV === 'production' && !existsSync(frontendIndex)) {
    throw new Error(
      `Production frontend build is missing at ${frontendIndex}. Run npm run build before npm start.`,
    );
  }
}

export interface RuntimeHandle {
  stop: () => void;
}

// The application's own upkeep: SQLite refreshes its query planner statistics.
declareMaintenance('database', [
  {
    name: 'optimize',
    everyMs: MAINTENANCE.INTERVAL_MS,
    run: () => {
      optimizeDatabase();
    },
  },
]);

let maintenance: MaintenanceHandle | undefined;

/**
 * Runs the maintenance Features declared while the app was composed: once
 * now, then on each task's interval. A failing task is logged and retried
 * on its next run; it never stops the server. Timers never keep the process
 * alive, and none exist until this is called.
 */
export function startApplicationMaintenance(options?: { intervalMs?: number; now?: number }): RuntimeHandle {
  stopApplicationMaintenance();
  maintenance = startMaintenance({
    ...options,
    onResult: ({ feature, task, details }) => Logger.info('Maintenance ran', { feature, task, ...details }),
    onFailure: ({ feature, task, error }) => Logger.error('Maintenance failed', { err: error, feature, task }),
  });
  return { stop: stopApplicationMaintenance };
}

export function stopApplicationMaintenance(): void {
  maintenance?.stop();
  maintenance = undefined;
}

export function stopApplicationRuntime(): void {
  stopApplicationMaintenance();
  closeEventStreams();
}

export function initializeApplicationRuntime(): RuntimeHandle {
  // An API route that forgot its guard would answer anyone; refuse to start instead.
  assertApiRoutesDeclareAccess(app);
  const migrationResult = migrate();
  Logger.info('Database migrations ready', {
    applied: migrationResult.applied,
    skipped: migrationResult.skipped,
  });
  // Feature bindings declared their permissions while composing the app above.
  const permissions = syncDeclaredPermissions();
  Logger.info('Permissions ready', { inserted: permissions.inserted, updated: permissions.updated });
  startApplicationMaintenance();
  return { stop: stopApplicationRuntime };
}

export function startServer(port = env.PORT) {
  try {
    ensureProductionFrontend();
    initializeApplicationRuntime();
    const server = serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        Logger.info(`Browser/API: ${env.APP_URL}`, {
          appUrl: env.APP_URL,
          browserUrl: env.APP_URL,
          port: info.port,
        });
      },
    );

    server.on('error', (error: Error) => {
      stopApplicationRuntime();
      Logger.fatal('Nara server error', error);
    });
    server.on('close', () => {
      stopApplicationRuntime();
    });

    return server;
  } catch (error) {
    Logger.error(
      'Nara failed to start',
      error instanceof Error ? error : { error: String(error) },
    );
    throw error;
  }
}
