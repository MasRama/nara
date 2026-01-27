import 'dotenv/config';
import { createApp } from '@nara-web/core';
import { vueAdapter } from '@nara-web/inertia-vue';
import { registerRoutes } from './routes/web.js';

const app = createApp({
  port: Number(process.env.PORT) || 3000,
  adapter: vueAdapter()
});

registerRoutes(app);
app.start();
