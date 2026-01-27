import 'dotenv/config';
import { createApp } from '@nara/core';
import { svelteAdapter } from '@nara/inertia-svelte';
import { registerRoutes } from './routes/web.js';

const app = createApp({
  port: Number(process.env.PORT) || 3000,
  adapter: svelteAdapter()
});

registerRoutes(app);
app.start();
