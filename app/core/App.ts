import express from "ultimate-express";
import compression from "compression";
import cookieParser from "cookie-parser";

import { initEnv, getEnvSummary, SERVER, AUTH } from "@config";
import type { Env } from "@config";
import Logger from "@services/Logger";
import { securityHeaders } from "@middlewares/securityHeaders";
import { requestLogger } from "@middlewares/requestLogger";
import { rateLimit } from "@middlewares/rateLimit";
import { csrf } from "@middlewares/csrf";
import { inputSanitize } from "@middlewares/inputSanitize";
import { requestId } from "@middlewares/requestId";
import { jsonError } from "./response";
import type { NaraRequest, NaraResponse } from "./types";
import type { FrontendAdapter } from "./adapters/types";
import { migrate } from "@services/Migrator";
import { cleanupExpiredSessions } from "@queries";

export interface AppOptions {
  port?: number;
  adapter?: FrontendAdapter;
  securityHeaders?: boolean;
  requestLogging?: boolean;
  rateLimit?: boolean;
  csrf?: boolean;
  inputSanitize?: boolean;
  autoMigrate?: boolean;
  routes?: any;
  shutdownTimeout?: number;
  errorHandler?: (req: NaraRequest, res: NaraResponse, error: unknown) => void;
}

const DEFAULT_OPTIONS = {
  port: 5555,
    securityHeaders: true,
  requestLogging: true,
  rateLimit: false,
  csrf: false,
  inputSanitize: true,
  autoMigrate: true,
  shutdownTimeout: 10000,
};

export interface NaraApp {
  start(): Promise<void>;
  close(): Promise<void>;
  use(middleware: any): NaraApp;
  use(path: string, middleware: any): NaraApp;
  mount(router: any, prefix?: string): NaraApp;
  getApp(): any;
  getEnv(): Env;
  isRunning(): boolean;
}

let sessionCleanupInterval: NodeJS.Timeout | null = null;

function startSessionCleanup(): void {
  if (sessionCleanupInterval) return;
  sessionCleanupInterval = setInterval(() => {
    cleanupExpiredSessions();
  }, AUTH.SESSION_CLEANUP_INTERVAL_MS);
}

export function createApp(options?: AppOptions): NaraApp {
  const env = initEnv();

  const opts = {
    ...DEFAULT_OPTIONS,
    port: env.PORT,
    adapter: undefined as FrontendAdapter | undefined,
    errorHandler: undefined as AppOptions["errorHandler"],
    routes: undefined as any,
    ...options,
  };

  const app = createServer();
  let server: any = null;
  let isStarted = false;
  let isShuttingDown = false;

  if (opts.autoMigrate) {
    migrate();
  }
  cleanupExpiredSessions();
  startSessionCleanup();

  applyDefaultMiddlewares(app, opts);
  setupErrorHandler(app, env, opts.errorHandler);
  setupSignalHandlers();

  if (opts.routes) {
    app.use(opts.routes);
  }

  function createServer(): any {
    const instance = express();
    instance.set("case sensitive routing", true);
    instance.disable("x-powered-by");
    instance.set("catch async errors", true);
    instance.set("body methods", ["POST", "PUT", "PATCH", "DELETE"]);
    instance.use(express.json({ limit: `${SERVER.MAX_BODY_SIZE / 1024 / 1024}mb` }));
    instance.use(express.urlencoded({ extended: true, limit: `${SERVER.MAX_BODY_SIZE / 1024 / 1024}mb` }));
    instance.use(cookieParser() as any);

    return instance;
  }

  function applyDefaultMiddlewares(instance: any, o: typeof opts): void {
    instance.use(compression());

    if (o.securityHeaders) instance.use(securityHeaders());
    instance.use(requestId());
    if (o.requestLogging) instance.use(requestLogger());
    if (o.rateLimit) instance.use(rateLimit());
    if (o.csrf) instance.use(csrf());
    if (o.inputSanitize) instance.use(inputSanitize());

    if (o.adapter) {
      instance.use(o.adapter.middleware() as any);
      instance.use((_req: any, res: any, next: any) => {
        o.adapter?.extendResponse?.(res as NaraResponse);
        next();
      });
    }
  }

  function setupErrorHandler(instance: any, envConfig: Env, customHandler?: AppOptions["errorHandler"]): void {
    instance.use((error: unknown, req: any, res: any, _next: any) => {
      if (customHandler) {
        return customHandler(req as NaraRequest, res as NaraResponse, error);
      }

      const isDevelopment = envConfig.NODE_ENV === "development";
      const err = error as Error & { statusCode?: number; code?: string };
      const statusCode = err.statusCode || 500;

      Logger.error("Unhandled request error", {
        err,
        path: req.path,
        method: req.method,
        statusCode,
        userAgent: req.headers["user-agent"],
      });

      return jsonError(
        res as NaraResponse,
        isDevelopment ? err.message : "Internal Server Error",
        statusCode,
        err.code
      );
    });
  }

  function setupSignalHandlers(): void {
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM", 0));
    process.on("SIGINT", () => gracefulShutdown("SIGINT", 0));
    process.on("uncaughtException", async (error: Error) => {
      Logger.fatal("Uncaught exception", error);
      await gracefulShutdown("uncaughtException", 1);
    });
    process.on("unhandledRejection", async (reason: unknown) => {
      Logger.fatal("Unhandled promise rejection", { reason });
      await gracefulShutdown("unhandledRejection", 1);
    });
  }

  async function gracefulShutdown(signal: string, exitCode: number = 0): Promise<void> {
    if (isShuttingDown) {
      Logger.warn("Shutdown already in progress, ignoring signal", { signal });
      return;
    }
    isShuttingDown = true;

    if (sessionCleanupInterval) {
      clearInterval(sessionCleanupInterval);
      sessionCleanupInterval = null;
    }

    const timeoutMs = opts.shutdownTimeout;
    Logger.info(`${signal} received, starting graceful shutdown...`);
    console.log(`\n⏳ Shutting down gracefully (max ${timeoutMs / 1000}s)...`);

    const forceExitTimeout = setTimeout(() => {
      Logger.error("Graceful shutdown timeout exceeded, forcing exit");
      console.log("❌ Shutdown timeout exceeded, forcing exit");
      process.exit(exitCode || 1);
    }, timeoutMs);

    try {
      Logger.info("Closing server (stop accepting new connections)...");
      if (server) {
        await new Promise<void>((resolve) => {
          server!.close(() => resolve());
        });
      }
      Logger.info("Server closed successfully");

      Logger.info("Closing database connections...");
      const SQLiteModule = await import("@services/SQLite");
      SQLiteModule.default.close();
      Logger.info("Database connections closed");

      Logger.info("Flushing logs...");
      await Logger.flush();

      clearTimeout(forceExitTimeout);
      console.log("✅ Graceful shutdown complete");
      process.exit(exitCode);
    } catch (error) {
      Logger.error("Error during graceful shutdown", error as Error);
      clearTimeout(forceExitTimeout);
      process.exit(exitCode || 1);
    }
  }

  const api: NaraApp = {
    async start(): Promise<void> {
      if (isStarted) {
        Logger.warn("Server already started");
        return;
      }

      const port = opts.port;

      try {
        await new Promise<void>((resolve, reject) => {
          server = app.listen(port, () => resolve());
          server!.on("error", reject);
        });

        isStarted = true;

        const envSummary = getEnvSummary(env);
        Logger.info("Server started successfully", { ...envSummary, nodeVersion: process.version });

        console.log(`\n🚀 Server is running at http://localhost:${port}\n`);
      } catch (err) {
        Logger.fatal("Failed to start server", err as Error);
        process.exit(1);
      }
    },

    async close(): Promise<void> {
      await gracefulShutdown("close", 0);
    },

    use(...args: any[]): NaraApp {
      app.use(...args);
      return api;
    },

    mount(router: any, prefix?: string): NaraApp {
      if (prefix) {
        app.use(prefix, router);
      } else {
        app.use(router);
      }
      return api;
    },

    getApp: () => app,
    getEnv: () => env,
    isRunning: () => isStarted && !isShuttingDown,
  };

  return api;
}

export function createWebApp(options: Omit<AppOptions, 'securityHeaders' | 'requestLogging' | 'inputSanitize' | 'autoMigrate'> & {
  adapter: FrontendAdapter;
  csrf?: boolean;
  rateLimit?: boolean;
}): NaraApp {
  return createApp({
        securityHeaders: true,
    requestLogging: true,
    inputSanitize: true,
    autoMigrate: true,
    csrf: true,
    ...options,
  });
}
