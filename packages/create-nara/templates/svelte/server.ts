import 'dotenv/config';
import { createApp, jsonError } from '@nara-web/core';
import { svelteAdapter } from '@nara-web/inertia-svelte';
import { registerRoutes } from './routes/web.js';
import Logger from './app/services/Logger.js';
import { requestLogger } from './app/middlewares/requestLogger.js';

const app = createApp({
  port: Number(process.env.PORT) || 3000,
  adapter: svelteAdapter()
});

// Request logging middleware
app.use(requestLogger());

// Global error handler
app.getServer().set_error_handler((req, res, error: any) => {
  Logger.error('[Server Error]', error);
  const message = error.message || 'Internal server error';
  const status = error.statusCode || 500;
  return jsonError(res, message, status);
});

registerRoutes(app);
app.start();
