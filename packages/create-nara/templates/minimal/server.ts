import 'dotenv/config';
import { createApp } from '@nara/core';
import { registerRoutes } from './routes/web.js';

const app = createApp({
  port: Number(process.env.PORT) || 3000
});

registerRoutes(app);
app.start();
