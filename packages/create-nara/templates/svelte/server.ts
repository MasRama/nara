import 'dotenv/config';
import { createApp, jsonError } from '@nara-web/core';
import { svelteAdapter } from '@nara-web/inertia-svelte';
import { registerRoutes } from './routes/web.js';

const app = createApp({
  port: Number(process.env.PORT) || 3000,
  adapter: svelteAdapter()
});

// Global error handler
app.getServer().set_error_handler((req, res, error: any) => {
  console.error('[Server Error]:', error);
  const message = error.message || 'Internal server error';
  const status = error.statusCode || 500;
  return jsonError(res, message, status);
});

registerRoutes(app);
app.start();
