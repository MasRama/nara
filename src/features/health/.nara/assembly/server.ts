import type { Hono } from 'hono';
import { healthRoutes } from '../../features/health';

export default function composeHealthServer(app: Hono): void {
  app.route('/health', healthRoutes);
}
