import 'dotenv/config';
import { createApp, jsonError } from '@nara-web/core';
import { registerRoutes } from './routes/web.js';

const app = createApp({
  port: Number(process.env.PORT) || 3000
});

// Global error handler
app.getServer().set_error_handler((req, res, error) => {
  console.error('[Server Error]:', error);
  return jsonError(res, error.message || 'Internal server error', error.statusCode || 500);
});

registerRoutes(app);
app.start();
