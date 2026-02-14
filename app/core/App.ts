/**
 * Nara Application Kernel
 * 
 * Central abstraction for bootstrapping and managing the application lifecycle.
 * Wraps environment initialization, server creation, middlewares, routes, and graceful shutdown.
 * 
 * @example
 * // server.ts
 * import { createApp } from '@core';
 * import routes from '@routes/web';
 * 
 * const app = createApp({ routes });
 * app.start();
 */

import HyperExpress from "hyper-express";
import cors from "cors";
import compression from "compression";
import path from "path";

import { initEnv, checkFeatureConfig, getEnvSummary, SERVER } from "@config";
import type { Env } from "@config";
import Logger from "@services/Logger";
import { securityHeaders } from "@middlewares/securityHeaders";
import { requestLogger } from "@middlewares/requestLogger";
import { rateLimit } from "@middlewares/rateLimit";
import { csrf } from "@middlewares/csrf";
import { HttpError, ValidationError, isHttpError } from "./errors";
import { jsonError, jsonValidationError } from "./response";
import type { NaraRequest, NaraResponse } from "./types";
import type { FrontendAdapter } from "./adapters/types";

/**
 * Application configuration options
 */
export interface AppOptions {
  /**
   * Port to listen on. Defaults to env.PORT or 5555.
   */
  port?: number;

  /**
   * Enable HTTPS. If true, uses env.HAS_CERTIFICATE to determine cert paths.
   * @default auto-detect from env
   */
  https?: boolean;

  /**
   * Enable CORS middleware.
   * @default true
   */
  cors?: boolean;

  /**
   * Frontend adapter (e.g., Inertia). If provided, enables frontend features.
   */
  adapter?: FrontendAdapter;

  /**
   * Enable security headers middleware (HSTS, X-Frame-Options, etc.).
   * @default true
   */
  securityHeaders?: boolean;

  /**
   * Enable request logging middleware.
   * @default true
   */
  requestLogging?: boolean;

  /**
   * Enable rate limiting middleware.
   * @default false (opt-in)
   */
  rateLimit?: boolean;

  /**
   * Enable CSRF protection middleware.
   * Protects POST/PUT/PATCH/DELETE requests using Double Submit Cookie pattern.
   * @default false (opt-in, see docs/SECURITY.md for details)
   */
  csrf?: boolean;

  /**
   * Application routes (HyperExpress.Router).
   * Can also be mounted later via app.mount()
   */
  routes?: HyperExpress.Router;

  /**
   * Graceful shutdown timeout in milliseconds.
   * @default 10000 (10 seconds)
   */
  shutdownTimeout?: number;

  /**
   * Custom error handler. If not provided, uses the default Nara error handler.
   */
  errorHandler?: (
    req: NaraRequest,
    res: NaraResponse,
    error: unknown
  ) => void;
}

/**
 * Default application options
 */
const DEFAULT_OPTIONS: Required<Omit<AppOptions, "routes" | "errorHandler" | "adapter">> & Pick<AppOptions, "adapter"> = {
  port: 5555,
  https: false,
  cors: true,
  adapter: undefined,
  securityHeaders: true,
  requestLogging: true,
  rateLimit: false, // Opt-in
  csrf: false, // Opt-in, see docs/SECURITY.md
  shutdownTimeout: 10000,
};

/**
 * Nara Application class
 * 
 * Manages the entire application lifecycle including:
 * - Environment initialization
 * - Server creation with optional HTTPS
 * - Global middleware registration
 * - Route mounting
 * - Error handling
 * - Graceful shutdown
 */
export class NaraApp {
  private server: HyperExpress.Server;
  private env: Env;
  private options: Required<Omit<AppOptions, "routes" | "errorHandler" | "adapter">> & Pick<AppOptions, "routes" | "errorHandler" | "adapter">;
  private isShuttingDown = false;
  private isStarted = false;

  constructor(options?: AppOptions) {
    // Initialize environment first
    this.env = initEnv();

    // Merge options with defaults
    this.options = {
      ...DEFAULT_OPTIONS,
      port: this.env.PORT,
      https: this.env.HAS_CERTIFICATE === "true",
      ...options,
    };

    // Log environment summary and warnings
    this.logEnvSummary();

    // Create server
    this.server = this.createServer();

    // Setup default error handler
    this.setupErrorHandler();

    // Setup process signal handlers for graceful shutdown
    this.setupSignalHandlers();

    // Apply default middlewares
    this.applyDefaultMiddlewares();

    // Mount routes if provided
    if (this.options.routes) {
      this.mount(this.options.routes);
    }
  }

  /**
   * Log environment summary and feature warnings
   */
  private logEnvSummary(): void {
    const featureWarnings = checkFeatureConfig(this.env);

    if (featureWarnings.length > 0) {
      console.log("\n⚠️  Optional features not configured:");
      featureWarnings.forEach((w: string) => console.log(`   - ${w}`));
      console.log("");
    }
  }

  /**
   * Create HyperExpress server with appropriate options
   */
  private createServer(): HyperExpress.Server {
    const serverOptions: {
      max_body_length: number;
      key_file_name?: string;
      cert_file_name?: string;
    } = {
      max_body_length: SERVER.MAX_BODY_SIZE,
    };

    // Enable HTTPS if configured
    if (this.options.https) {
      serverOptions.key_file_name = path.join(process.cwd(), "localhost+1-key.pem");
      serverOptions.cert_file_name = path.join(process.cwd(), "localhost+1.pem");
    }

    return new HyperExpress.Server(serverOptions);
  }

  /**
   * Apply default middlewares (Security Headers, Request Logging, CORS, Rate Limit, Inertia)
   */
  private applyDefaultMiddlewares(): void {
    // Compression should be first for better performance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.server.use(compression() as any);

    // Security headers should be first to ensure all responses have them
    if (this.options.securityHeaders) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.server.use(securityHeaders() as any);
    }

    // Request logging early to capture all requests
    if (this.options.requestLogging) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.server.use(requestLogger() as any);
    }

    if (this.options.cors) {
      this.server.use(cors());
    }

    // Rate limiting after CORS but before route handlers
    if (this.options.rateLimit) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.server.use(rateLimit() as any);
    }

    // CSRF protection after rate limiting but before route handlers
    if (this.options.csrf) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.server.use(csrf() as any);
    }

    if (this.options.adapter) {
      // Apply adapter middleware
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.server.use(this.options.adapter.middleware() as any);

      // Register response extensions
      this.server.use((_req, res, next) => {
        this.options.adapter?.extendResponse(res as NaraResponse);
        next();
      });
    }
  }

  /**
   * Setup the global error handler
   */
  private setupErrorHandler(): void {
    const customHandler = this.options.errorHandler;

    this.server.set_error_handler((req, res, error: unknown) => {
      // Use custom handler if provided
      if (customHandler) {
        return customHandler(req as NaraRequest, res as NaraResponse, error);
      }

      // Default error handling
      const isDevelopment = this.env.NODE_ENV === "development";

      // Handle known HttpError types
      if (isHttpError(error)) {
        Logger.warn("HTTP error", {
          name: error.name,
          message: error.message,
          statusCode: error.statusCode,
          code: error.code,
          path: req.path,
          method: req.method,
        });

        // Special handling for ValidationError
        if (error instanceof ValidationError) {
          // Check if this is an Inertia request
          const isInertia = req.headers["x-inertia"] === "true";

          if (isInertia) {
            // For Inertia requests, redirect back with error cookie
            const referer = req.headers["referer"] || "/";
            const errorMsg = (error.errors && Object.keys(error.errors).length > 0)
              ? Object.values(error.errors).flat().join(", ")
              : error.message;

            return (res as NaraResponse)
              .cookie("error", errorMsg, 5000)
              .setHeader('X-Inertia-Location', referer)
              .redirect(referer);
          }

          // For API requests, return JSON
          return jsonValidationError(
            res as NaraResponse,
            error.message,
            error.errors
          );
        }

        return jsonError(
          res as NaraResponse,
          error.message,
          error.statusCode,
          error.code
        );
      }

      // Handle unknown errors
      const err = error as Error;
      const statusCode =
        (error as { statusCode?: number }).statusCode ||
        ((error as { code?: string }).code === "SQLITE_ERROR" ? 500 : 500);

      Logger.error("Unhandled request error", {
        err: err,
        path: req.path,
        method: req.method,
        statusCode,
        userAgent: req.headers["user-agent"],
      });

      return jsonError(
        res as NaraResponse,
        isDevelopment ? err.message : "Internal Server Error",
        statusCode,
        (error as { code?: string }).code
      );
    });
  }

  /**
   * Setup process signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // SIGTERM (Docker/K8s stop)
    process.on("SIGTERM", () => this.gracefulShutdown("SIGTERM", 0));

    // SIGINT (Ctrl+C)
    process.on("SIGINT", () => this.gracefulShutdown("SIGINT", 0));

    // Uncaught exceptions
    process.on("uncaughtException", async (error: Error) => {
      Logger.fatal("Uncaught exception", error);
      await this.gracefulShutdown("uncaughtException", 1);
    });

    // Unhandled promise rejections
    process.on("unhandledRejection", async (reason: unknown) => {
      Logger.fatal("Unhandled promise rejection", { reason });
      await this.gracefulShutdown("unhandledRejection", 1);
    });
  }

  /**
   * Graceful shutdown handler
   * 
   * Properly closes the server and drains existing connections before exit.
   * This prevents in-flight requests from being dropped during deploy/restart.
   */
  private async gracefulShutdown(signal: string, exitCode: number = 0): Promise<void> {
    // Prevent multiple shutdown attempts
    if (this.isShuttingDown) {
      Logger.warn("Shutdown already in progress, ignoring signal", { signal });
      return;
    }
    this.isShuttingDown = true;

    const timeoutMs = this.options.shutdownTimeout;
    Logger.info(`${signal} received, starting graceful shutdown...`);
    console.log(`\n⏳ Shutting down gracefully (max ${timeoutMs / 1000}s)...`);

    // Set a hard timeout to force exit if graceful shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      Logger.error("Graceful shutdown timeout exceeded, forcing exit");
      console.log("❌ Shutdown timeout exceeded, forcing exit");
      process.exit(exitCode || 1);
    }, timeoutMs);

    try {
      // Step 1: Stop accepting new connections
      Logger.info("Closing server (stop accepting new connections)...");
      await this.server.close();
      Logger.info("Server closed successfully");

      // Step 2: Close database connections
      Logger.info("Closing database connections...");
      const DB = (await import("@services/DB")).default;
      await DB.destroy();
      Logger.info("Database connections closed");

      // Step 3: Flush logs
      Logger.info("Flushing logs...");
      await Logger.flush();

      // Clear the force exit timeout
      clearTimeout(forceExitTimeout);

      console.log("✅ Graceful shutdown complete");
      process.exit(exitCode);
    } catch (error) {
      Logger.error("Error during graceful shutdown", error as Error);
      clearTimeout(forceExitTimeout);
      process.exit(exitCode || 1);
    }
  }

  /**
   * Add a middleware to the application
   * 
   * @param middleware - Middleware function or path + middleware
   * @returns this for chaining
   * 
   * @example
   * app.use(myMiddleware);
   * app.use('/api', apiMiddleware);
   */
  use(middleware: Parameters<HyperExpress.Server["use"]>[0]): this;
  use(path: string, middleware: Parameters<HyperExpress.Server["use"]>[0]): this;
  use(...args: unknown[]): this {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.server.use as any)(...args);
    return this;
  }

  /**
   * Mount a router to the application
   * 
   * @param router - HyperExpress router to mount
   * @param prefix - Optional path prefix
   * @returns this for chaining
   * 
   * @example
   * app.mount(webRoutes);
   * app.mount('/api', apiRoutes);
   */
  mount(router: HyperExpress.Router, prefix?: string): this {
    if (prefix) {
      this.server.use(prefix, router);
    } else {
      this.server.use(router);
    }
    return this;
  }

  /**
   * Start the application server
   * 
   * @returns Promise that resolves when server is listening
   * 
   * @example
   * await app.start();
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      Logger.warn("Server already started");
      return;
    }

    const port = this.options.port;

    try {
      await this.server.listen(port);
      this.isStarted = true;

      const envSummary = getEnvSummary(this.env);
      Logger.info("Server started successfully", {
        ...envSummary,
        nodeVersion: process.version,
      });

      const protocol = this.options.https ? "https" : "http";
      console.log(`\n🚀 Server is running at ${protocol}://localhost:${port}\n`);
    } catch (err) {
      Logger.fatal("Failed to start server", err as Error);
      process.exit(1);
    }
  }

  /**
   * Stop the application server
   * 
   * @returns Promise that resolves when server is closed
   */
  async close(): Promise<void> {
    await this.gracefulShutdown("close", 0);
  }

  /**
   * Get the underlying HyperExpress server instance
   * 
   * Useful for advanced configuration or testing.
   */
  getServer(): HyperExpress.Server {
    return this.server;
  }

  /**
   * Get the environment configuration
   */
  getEnv(): Env {
    return this.env;
  }

  /**
   * Check if the server is currently running
   */
  isRunning(): boolean {
    return this.isStarted && !this.isShuttingDown;
  }
}

/**
 * Create a new Nara application instance
 * 
 * Factory function for creating NaraApp instances.
 * This is the recommended way to bootstrap a Nara application.
 * 
 * @param options - Application configuration options
 * @returns NaraApp instance
 * 
 * @example
 * // Minimal setup
 * import { createApp } from '@core';
 * import routes from '@routes/web';
 * 
 * const app = createApp({ routes });
 * app.start();
 * 
 * @example
 * // With custom options
 * const app = createApp({
 *   port: 3000,
 *   cors: true,
 *   inertia: true,
 *   routes: webRoutes,
 *   shutdownTimeout: 15000,
 * });
 * app.start();
 */
export function createApp(options?: AppOptions): NaraApp {
  return new NaraApp(options);
}
