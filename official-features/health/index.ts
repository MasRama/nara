import { Hono } from 'hono';
import type { HealthResponse } from './contract';

export const healthRoutes = new Hono().get('/', (context) => {
  const response: HealthResponse = { status: 'ok' };
  return context.json(response);
});
