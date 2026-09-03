import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { env } from '../shared/config';
import { Logger } from '../shared/logging';
import { handleError } from './error-handler';
import { getDatabase, migrate } from '../shared/database';
import { authRoutes, accessRoutes } from '../features/auth';
import { userRoutes, assetRoutes } from '../features/users';
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

app.onError(handleError);

app.route('/health', healthRoutes);
app.get('/ready', (context) => {
  try {
    getDatabase().prepare('SELECT 1').get();
    return context.json({ status: 'ok' });
  } catch {
    return context.json({ status: 'error' }, 503);
  }
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

app.route('/api/auth', authRoutes);
app.route('/api/roles', accessRoutes);
app.route('/api/assets', assetRoutes);
app.route('/api/users', userRoutes);

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

export function startServer(port = env.PORT) {
  try {
    ensureProductionFrontend();
    const migrationResult = migrate();
    Logger.info('Database migrations ready', {
      applied: migrationResult.applied,
      skipped: migrationResult.skipped,
    });

    const server = serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        const startupMessage =
          env.NODE_ENV === 'development'
            ? `Browser: ${env.APP_URL} (Vite); Backend implementation: http://localhost:${info.port}`
            : `Browser/API: ${env.APP_URL}`;
        Logger.info(startupMessage, {
          appUrl: env.APP_URL,
          browserUrl: env.APP_URL,
          port: info.port,
        });
      },
    );

    server.on('error', (error: Error) => {
      Logger.error('Nara v3 server error', error);
    });

    return server;
  } catch (error) {
    Logger.error(
      'Nara v3 failed to start',
      error instanceof Error ? error : { error: String(error) },
    );
    throw error;
  }
}
