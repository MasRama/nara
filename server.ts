// Nara Server Entrypoint
// Boots the HTTP server, wires middlewares & routes,
// loads environment variables, and configures HTTPS for local development.

// Load and validate environment variables first
import { initEnv, checkFeatureConfig, getEnvSummary, SERVER } from "./app/config";
const env = initEnv();

// Logger service for structured logging
import Logger from "./app/services/Logger";

// Log environment summary and warnings
const envSummary = getEnvSummary(env);
const featureWarnings = checkFeatureConfig(env);

if (featureWarnings.length > 0) {
  console.log('\n⚠️  Optional features not configured:');
  featureWarnings.forEach(w => console.log(`   - ${w}`));
  console.log('');
}

// Inertia middleware: integrates Inertia.js responses for SSR-like pages
import inertia from "./app/middlewares/inertia";

// Application routes definition (all app endpoints)
import Web from "./routes/web";

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

// Graceful shutdown: handle SIGTERM (e.g., Docker/K8s stop)
process.on("SIGTERM", async () => {
   Logger.info("SIGTERM signal received, shutting down gracefully");
   await Logger.flush();
   process.exit(0);
});

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", async () => {
   Logger.info("SIGINT signal received, shutting down gracefully");
   await Logger.flush();
   process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error: Error) => {
   Logger.fatal("Uncaught exception", error);
   await Logger.flush();
   process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason: any) => {
   Logger.fatal("Unhandled promise rejection", { reason });
   await Logger.flush();
   process.exit(1);
});
