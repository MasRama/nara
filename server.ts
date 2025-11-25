// Nara Server Entrypoint
// Boots the HTTP server, wires middlewares & routes,
// loads environment variables, and configures HTTPS for local development.

// Load and validate environment variables first
import { initEnv, checkFeatureConfig, getEnvSummary, SERVER } from "@config";
const env = initEnv();

// Logger service for structured logging
import Logger from "@services/Logger";

// Log environment summary and warnings
const envSummary = getEnvSummary(env);
const featureWarnings = checkFeatureConfig(env);

if (featureWarnings.length > 0) {
  console.log('\n⚠️  Optional features not configured:');
  featureWarnings.forEach((w: string) => console.log(`   - ${w}`));
  console.log('');
}

// Inertia middleware: integrates Inertia.js responses for SSR-like pages
import inertia from "@middlewares/inertia";

// Application routes definition (all app endpoints)
import Web from "@routes/web";

// HyperExpress: high-performance HTTP server framework
import HyperExpress from "hyper-express";

// CORS middleware to allow cross-origin requests
import cors from 'cors';

// Node.js path utilities (used to resolve HTTPS certificate paths)
import path from 'path';
 
// Base server options: request body limit and TLS placeholders
const option = {
  max_body_length: SERVER.MAX_BODY_SIZE,
  key_file_name : "",
  cert_file_name : "",
};

// Enable HTTPS when HAS_CERTIFICATE='true' using local dev certificates
if (env.HAS_CERTIFICATE === 'true') {
  option.key_file_name = path.join(process.cwd(), 'localhost+1-key.pem');
  option.cert_file_name = path.join(process.cwd(), 'localhost+1.pem');
}

// Create the HyperExpress server with the above options
const webserver = new HyperExpress.Server(option);

// Global middlewares
webserver.use(cors()); // Enable CORS for cross-origin requests

// @ts-expect-error - Type compatibility issue between HyperExpress and extended Response interface
// The middleware works correctly at runtime, adding view/inertia/flash methods to Response
webserver.use(inertia()); // Enable Inertia middleware for SSR-like responses

// Mount application routes
webserver.use(Web); 

// Use validated port from environment
const PORT = env.PORT;
 
// Global error handler (runs for unhandled errors in requests)
webserver.set_error_handler((req, res, error: any) => {
   // Log error with context
   Logger.error('Request error', {
      err: error,
      path: req.path,
      method: req.method,
      statusCode: error.statusCode || 500,
      userAgent: req.headers['user-agent'],
   });

   // Determine status code
   const statusCode = error.statusCode || (error.code === "SQLITE_ERROR" ? 500 : 500);
   res.status(statusCode);

   // Return appropriate error response based on environment
   const isDevelopment = env.NODE_ENV === 'development';
   res.json({
      success: false,
      message: isDevelopment ? error.message : 'Internal Server Error',
      ...(isDevelopment && { 
         error: error.message,
         stack: error.stack,
         code: error.code 
      })
   });
});

// Start the server and log the local URL
webserver
   .listen(PORT)
   .then(() => {
      Logger.info('Server started successfully', {
         ...envSummary,
         nodeVersion: process.version,
      });
      const protocol = env.HAS_CERTIFICATE === 'true' ? 'https' : 'http';
      console.log(`\n🚀 Server is running at ${protocol}://localhost:${PORT}\n`);
   })
   .catch((err: any) => {
      Logger.fatal('Failed to start server', err);
      process.exit(1);
   });

// Graceful shutdown configuration
const SHUTDOWN_TIMEOUT_MS = 10000; // 10 seconds max wait for connections to drain
let isShuttingDown = false;

/**
 * Graceful shutdown handler
 * 
 * Properly closes the server and drains existing connections before exit.
 * This prevents in-flight requests from being dropped during deploy/restart.
 * 
 * @param signal - The signal that triggered shutdown (SIGTERM, SIGINT, etc.)
 * @param exitCode - Exit code to use (0 for normal, 1 for error)
 */
async function gracefulShutdown(signal: string, exitCode: number = 0): Promise<void> {
   // Prevent multiple shutdown attempts
   if (isShuttingDown) {
      Logger.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
   }
   isShuttingDown = true;

   Logger.info(`${signal} received, starting graceful shutdown...`);
   console.log(`\n⏳ Shutting down gracefully (max ${SHUTDOWN_TIMEOUT_MS / 1000}s)...`);

   // Set a hard timeout to force exit if graceful shutdown takes too long
   const forceExitTimeout = setTimeout(() => {
      Logger.error('Graceful shutdown timeout exceeded, forcing exit');
      console.log('❌ Shutdown timeout exceeded, forcing exit');
      process.exit(exitCode || 1);
   }, SHUTDOWN_TIMEOUT_MS);

   try {
      // Step 1: Stop accepting new connections
      Logger.info('Closing server (stop accepting new connections)...');
      await webserver.close();
      Logger.info('Server closed successfully');

      // Step 2: Close database connections
      Logger.info('Closing database connections...');
      const DB = (await import("@services/DB")).default;
      await DB.destroy();
      Logger.info('Database connections closed');

      // Step 3: Flush logs
      Logger.info('Flushing logs...');
      await Logger.flush();

      // Clear the force exit timeout
      clearTimeout(forceExitTimeout);

      console.log('✅ Graceful shutdown complete');
      process.exit(exitCode);
   } catch (error) {
      Logger.error('Error during graceful shutdown', error as Error);
      clearTimeout(forceExitTimeout);
      process.exit(exitCode || 1);
   }
}

// Graceful shutdown: handle SIGTERM (e.g., Docker/K8s stop)
process.on("SIGTERM", () => gracefulShutdown("SIGTERM", 0));

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", () => gracefulShutdown("SIGINT", 0));

// Handle uncaught exceptions
process.on("uncaughtException", async (error: Error) => {
   Logger.fatal("Uncaught exception", error);
   await gracefulShutdown("uncaughtException", 1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason: any) => {
   Logger.fatal("Unhandled promise rejection", { reason });
   await gracefulShutdown("unhandledRejection", 1);
});
