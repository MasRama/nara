import 'dotenv/config';
import { createApp } from '@nara-web/core';
import { svelteAdapter } from '@nara-web/inertia-svelte';
import { registerRoutes } from './routes/web.js';

const app = createApp({
  port: Number(process.env.PORT) || 3000,
  adapter: svelteAdapter()
});

registerRoutes(app);
app.start();
