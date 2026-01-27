/**
 * Nara Server Entrypoint
 * 
 * Minimal entry point that bootstraps the application using the NaraApp kernel.
 * All server configuration, middlewares, error handling, and graceful shutdown
 * are managed by the App abstraction in @core.
 * 
 * @see app/core/App.ts for the full implementation
 */

import { createApp, svelteAdapter } from "@core";
import routes from "@routes/web";

// Create and start the application
const app = createApp({
  routes,
  // Add Svelte adapter to enable Inertia support
  adapter: svelteAdapter(),
  // All other options are auto-configured from environment:
  // - port: from env.PORT (default 5555)
  // - https: from env.HAS_CERTIFICATE
  // - cors: enabled by default
  // - shutdownTimeout: 10 seconds
});

app.start();
