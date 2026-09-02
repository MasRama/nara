import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from '../shared/config';
import { Logger } from '../shared/logging';
import { handleError } from './error-handler';
import { getDatabase } from '../shared/database';
import { authRoutes, accessRoutes } from '../features/auth';
import { userRoutes, assetRoutes } from '../features/users';
import { healthRoutes } from '../../official-features/health';

export const app = new Hono();

app.onError(handleError);

app.get('/', (context) => context.json({ name: 'Nara', version: '3.0.0' }));
app.route('/health', healthRoutes);
app.get('/ready', (context) => {
  try {
    getDatabase().prepare('SELECT 1').get();
    return context.json({ status: 'ok' });
  } catch {
    return context.json({ status: 'error' }, 503);
  }
});

app.route('/api/auth', authRoutes);
app.route('/api/roles', accessRoutes);
app.route('/api/assets', assetRoutes);
app.route('/api/users', userRoutes);

export function startServer(port = env.PORT) {
  try {
    const server = serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        Logger.info('Server started successfully', {
          port: info.port,
          appUrl: env.APP_URL,
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
