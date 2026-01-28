import 'dotenv/config';
import { createApp, jsonError } from '@nara-web/core';
import { vueAdapter } from '@nara-web/inertia-vue';
import { registerRoutes } from './routes/web.js';
import { view } from './app/services/View.js';

const app = createApp({
  port: Number(process.env.PORT) || 3000,
  adapter: vueAdapter({ viewFn: view } as any)
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
