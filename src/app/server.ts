import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { compress } from 'hono/compress';
import { Hono } from 'hono';
import { MAINTENANCE, env } from '../shared/config';
import {
  apiBodyLimit,
  createRateLimiter,
  csrfProtection,
  securityHeaders,
} from '../shared/security';
import { Logger } from '../shared/logging';
import { handleError } from './error-handler';
import { requestId, requestLifecycleLog } from './observability';
import {
  createAuthRoutes,
  createAccessRoutes,
  cleanupExpiredSessions,
  passwordChangeGate,
  resetLoginThrottle,
  SESSION_CLEANUP_INTERVAL_MS,
} from '../features/auth';
import {
  discoverMigrations,
  getDatabase,
  migrate,
  optimizeDatabase,
  outstandingMigrations,
  type MigrationFile,
} from '../shared/database';
import { pruneExpiredActivity } from '../features/activity';
import { AVATAR_MAX_FILE_SIZE_BYTES } from '../features/users';
import composeUsersServer from './bindings/users.server';
import composeActivityServer, { authActivitySink, recordApplicationActivity } from './bindings/activity.server';
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

const isProductionServer = env.NODE_ENV === 'production';

function isApiRequest(context: { req: { url: string } }): boolean {
  return new URL(context.req.url).pathname.startsWith('/api/');
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

const authRateLimiter = createRateLimiter({
  maxRequests: env.AUTH_RATE_LIMIT_MAX,
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  name: 'auth',
});

/** Deterministic test reset: clears limiter buckets and login lockout state. */
export function resetSecurityState(): void {
  globalRateLimiter.reset();
  authRateLimiter.reset();
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
app.use('/api/auth/login', authRateLimiter.middleware);
app.use('/api/auth/register', authRateLimiter.middleware);
app.use('/api/auth/change-password', authRateLimiter.middleware);
app.use('/api/auth/logout', authRateLimiter.middleware);
// Covers the sign-in code step and password-confirmed two-factor management.
app.use('/api/auth/two-factor/*', authRateLimiter.middleware);
app.use('/api/assets/avatar', authRateLimiter.middleware);
app.use('*', csrfProtection({ isProduction: isProductionServer }));
// Auth decides which of its own routes stay reachable; the prefix matches its mount below.
app.use('/api/*', passwordChangeGate('/api/auth'));
// Route-owned body budgets: every state-changing /api/* request is bounded
// by MAX_JSON_BODY_BYTES regardless of declared Content-Type; only
// POST /api/assets/avatar owns the narrowly larger upload request budget
// (the Users avatar limit + 256 KiB framing) with the Feature file check authoritative.
app.use('*', apiBodyLimit({ jsonMaxBytes: env.MAX_JSON_BODY_BYTES, uploadMaxBytes: AVATAR_MAX_FILE_SIZE_BYTES + 256 * 1024 }));

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

app.route('/api/auth', createAuthRoutes(authActivitySink));
app.route('/api/roles', createAccessRoutes(authActivitySink));
composeUsersServer(app, { recordActivity: recordApplicationActivity });
composeActivityServer(app);

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

let sessionCleanupTimer: NodeJS.Timeout | undefined;
let applicationMaintenanceTimer: NodeJS.Timeout | undefined;

/**
 * App-owned session cleanup scheduling. Runs Auth's expired-session delete
 * once the database is ready, then on one periodic interval. Exactly one
 * timer exists; it is unref'd so it never blocks process exit, and
 * {@link stopSessionCleanup} clears it on shutdown. No timers are created
 * at import time.
 */
export function startSessionCleanup(options?: { intervalMs?: number; now?: number }): RuntimeHandle {
  stopSessionCleanup();
  const removed = cleanupExpiredSessions(options?.now ?? Date.now());
  if (removed > 0) Logger.info('Expired sessions removed', { removed });
  const timer = setInterval(
    () => {
      try {
        cleanupExpiredSessions();
      } catch (error) {
        Logger.error('Expired session cleanup failed', error instanceof Error ? error : new Error(String(error)));
      }
    },
    options?.intervalMs ?? SESSION_CLEANUP_INTERVAL_MS,
  );
  if (typeof timer.unref === 'function') timer.unref();
  sessionCleanupTimer = timer;
  return { stop: stopSessionCleanup };
}

export function stopSessionCleanup(): void {
  if (sessionCleanupTimer) {
    clearInterval(sessionCleanupTimer);
    sessionCleanupTimer = undefined;
  }
}

function pruneExpiredActivityAndLog(now = Date.now()): void {
  const { removed, retentionDays } = pruneExpiredActivity(now);
  if (removed > 0) {
    Logger.info('Expired activity events removed', { removed, retentionDays });
  }
}

function runApplicationMaintenance(now = Date.now()): void {
  try {
    optimizeDatabase();
  } catch (error) {
    Logger.error('SQLite optimize failed', error instanceof Error ? error : new Error(String(error)));
  }

  try {
    pruneExpiredActivityAndLog(now);
  } catch (error) {
    Logger.error('Activity retention cleanup failed', error instanceof Error ? error : new Error(String(error)));
  }
}

export function startApplicationMaintenance(options?: { intervalMs?: number; now?: number }): RuntimeHandle {
  stopApplicationMaintenance();

  try {
    pruneExpiredActivityAndLog(options?.now ?? Date.now());
  } catch (error) {
    Logger.error('Activity retention cleanup failed', error instanceof Error ? error : new Error(String(error)));
  }

  const timer = setInterval(
    () => runApplicationMaintenance(),
    options?.intervalMs ?? MAINTENANCE.INTERVAL_MS,
  );
  timer.unref?.();
  applicationMaintenanceTimer = timer;
  return { stop: stopApplicationMaintenance };
}

export function stopApplicationMaintenance(): void {
  if (applicationMaintenanceTimer) {
    clearInterval(applicationMaintenanceTimer);
    applicationMaintenanceTimer = undefined;
  }
}

export function stopApplicationRuntime(): void {
  stopSessionCleanup();
  stopApplicationMaintenance();
}

export function initializeApplicationRuntime(): RuntimeHandle {
  const migrationResult = migrate();
  Logger.info('Database migrations ready', {
    applied: migrationResult.applied,
    skipped: migrationResult.skipped,
  });
  startSessionCleanup();
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
