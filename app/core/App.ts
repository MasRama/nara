import express from "ultimate-express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";

import { initEnv, checkFeatureConfig, getEnvSummary, SERVER } from "@config";
import type { Env } from "@config";
import Logger from "@services/Logger";
import { securityHeaders } from "@middlewares/securityHeaders";
import { requestLogger } from "@middlewares/requestLogger";
import { rateLimit } from "@middlewares/rateLimit";
import { csrf } from "@middlewares/csrf";
import { inputSanitize } from "@middlewares/inputSanitize";
import { requestId } from "@middlewares/requestId";
import { isNaraError, isValidationError } from "./errors";
import { jsonError, jsonValidationError } from "./response";
import type { NaraMiddleware, NaraRequest, NaraResponse } from "./types";
import type { FrontendAdapter } from "./adapters/types";

function adapt(middleware: NaraMiddleware): any {
  return (req: any, res: any, next: any) =>
    middleware(req as NaraRequest, res as NaraResponse, next);
}

export interface AppOptions {
  port?: number;
  https?: boolean;
  cors?: boolean;
  adapter?: FrontendAdapter;
  securityHeaders?: boolean;
  requestLogging?: boolean;
  rateLimit?: boolean;
  csrf?: boolean;
  inputSanitize?: boolean;
  routes?: any;
  shutdownTimeout?: number;
  errorHandler?: (req: NaraRequest, res: NaraResponse, error: unknown) => void;
}

const DEFAULT_OPTIONS = {
  port: 5555,
  https: false,
  cors: true,
  securityHeaders: true,
  requestLogging: true,
  rateLimit: false,
  csrf: false,
  inputSanitize: true,
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

export function createApp(options?: AppOptions): NaraApp {
  const env = initEnv();

  const opts = {
    ...DEFAULT_OPTIONS,
    port: env.PORT,
    https: env.HAS_CERTIFICATE === "true",
    adapter: undefined as FrontendAdapter | undefined,
    errorHandler: undefined as AppOptions["errorHandler"],
    routes: undefined as any,
    ...options,
  };

  const featureWarnings = checkFeatureConfig(env);
  if (featureWarnings.length > 0) {
    console.log("\n⚠️  Optional features not configured:");
    featureWarnings.forEach((w: string) => console.log(`   - ${w}`));
    console.log("");
  }

  const app = createServer(opts);
  let server: any = null;
  let isStarted = false;
  let isShuttingDown = false;

  applyDefaultMiddlewares(app, opts);
  setupErrorHandler(app, env, opts.errorHandler);
  setupSignalHandlers();

  if (opts.routes) {
    app.use(opts.routes);
  }

  function createServer(o: typeof opts): any {
    const appOptions: Record<string, unknown> = {};

    if (o.https) {
      appOptions.uwsOptions = {
        key_file_name: require("path").join(process.cwd(), "localhost+1-key.pem"),
        cert_file_name: require("path").join(process.cwd(), "localhost+1.pem"),
      };
    }

    const instance = express(appOptions);
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

    if (o.securityHeaders) instance.use(adapt(securityHeaders()));
    instance.use(adapt(requestId()));
    if (o.requestLogging) instance.use(adapt(requestLogger()));
    if (o.cors) instance.use(cors());
    if (o.rateLimit) instance.use(adapt(rateLimit()));
    if (o.csrf) instance.use(adapt(csrf()));
    if (o.inputSanitize) instance.use(adapt(inputSanitize()));

    if (o.adapter) {
      instance.use(adapt(o.adapter.middleware() as NaraMiddleware));
      instance.use((_req: any, res: any, next: any) => {
        o.adapter?.extendResponse(res as NaraResponse);
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

      if (isNaraError(error)) {
        Logger.warn("HTTP error", {
          name: error.name,
          message: error.message,
          statusCode: error.statusCode,
          code: error.code,
          path: req.path,
          method: req.method,
        });

        if (isValidationError(error)) {
          const isInertia = req.headers["x-inertia"] === "true";

          if (isInertia) {
            const referer = (req.headers["referer"] as string) || "/";
            const errorMsg = (error.errors && Object.keys(error.errors).length > 0)
              ? Object.values(error.errors).flat().join(", ")
              : error.message;

            return (res as NaraResponse)
              .cookie("error", errorMsg, { maxAge: 5000 })
              .setHeader('X-Inertia-Location', referer)
              .redirect(referer);
          }

          return jsonValidationError(res as NaraResponse, error.message, error.errors);
        }

        const { message, statusCode, code } = error;
        return jsonError(res as NaraResponse, message, statusCode, code);
      }

      const err = error as Error;
      const statusCode = (error as { statusCode?: number }).statusCode || 500;

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
        (error as { code?: string }).code
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

        const protocol = opts.https ? "https" : "http";
        console.log(`\n🚀 Server is running at ${protocol}://localhost:${port}\n`);
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
