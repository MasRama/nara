"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaraApp = void 0;
exports.createApp = createApp;
const hyper_express_1 = __importDefault(require("hyper-express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const _config_1 = require("@config");
const Logger_1 = __importDefault(require("@services/Logger"));
const securityHeaders_1 = require("@middlewares/securityHeaders");
const requestLogger_1 = require("@middlewares/requestLogger");
const rateLimit_1 = require("@middlewares/rateLimit");
const csrf_1 = require("@middlewares/csrf");
const errors_1 = require("./errors");
const response_1 = require("./response");
const DEFAULT_OPTIONS = {
    port: 5555,
    https: false,
    cors: true,
    adapter: undefined,
    securityHeaders: true,
    requestLogging: true,
    rateLimit: false,
    csrf: false,
    shutdownTimeout: 10000,
};
class NaraApp {
    constructor(options) {
        this.isShuttingDown = false;
        this.isStarted = false;
        this.env = (0, _config_1.initEnv)();
        this.options = {
            ...DEFAULT_OPTIONS,
            port: this.env.PORT,
            https: this.env.HAS_CERTIFICATE === "true",
            ...options,
        };
        this.logEnvSummary();
        this.server = this.createServer();
        this.setupErrorHandler();
        this.setupSignalHandlers();
        this.applyDefaultMiddlewares();
        if (this.options.routes) {
            this.mount(this.options.routes);
        }
    }
    logEnvSummary() {
        const featureWarnings = (0, _config_1.checkFeatureConfig)(this.env);
        if (featureWarnings.length > 0) {
            console.log("\n⚠️  Optional features not configured:");
            featureWarnings.forEach((w) => console.log(`   - ${w}`));
            console.log("");
        }
    }
    createServer() {
        const serverOptions = {
            max_body_length: _config_1.SERVER.MAX_BODY_SIZE,
        };
        if (this.options.https) {
            serverOptions.key_file_name = path_1.default.join(process.cwd(), "localhost+1-key.pem");
            serverOptions.cert_file_name = path_1.default.join(process.cwd(), "localhost+1.pem");
        }
        return new hyper_express_1.default.Server(serverOptions);
    }
    applyDefaultMiddlewares() {
        if (this.options.securityHeaders) {
            this.server.use((0, securityHeaders_1.securityHeaders)());
        }
        if (this.options.requestLogging) {
            this.server.use((0, requestLogger_1.requestLogger)());
        }
        if (this.options.cors) {
            this.server.use((0, cors_1.default)());
        }
        if (this.options.rateLimit) {
            this.server.use((0, rateLimit_1.rateLimit)());
        }
        if (this.options.csrf) {
            this.server.use((0, csrf_1.csrf)());
        }
        if (this.options.adapter) {
            this.server.use(this.options.adapter.middleware());
            this.server.use((_req, res, next) => {
                this.options.adapter?.extendResponse(res);
                next();
            });
        }
    }
    setupErrorHandler() {
        const customHandler = this.options.errorHandler;
        this.server.set_error_handler((req, res, error) => {
            if (customHandler) {
                return customHandler(req, res, error);
            }
            const isDevelopment = this.env.NODE_ENV === "development";
            if ((0, errors_1.isHttpError)(error)) {
                Logger_1.default.warn("HTTP error", {
                    name: error.name,
                    message: error.message,
                    statusCode: error.statusCode,
                    code: error.code,
                    path: req.path,
                    method: req.method,
                });
                if (error instanceof errors_1.ValidationError) {
                    const isInertia = req.headers["x-inertia"] === "true";
                    if (isInertia) {
                        const referer = req.headers["referer"] || "/";
                        const errorMsg = error.errors
                            ? Object.values(error.errors).flat().join(", ")
                            : error.message;
                        return res
                            .cookie("error", errorMsg, 5000)
                            .redirect(referer);
                    }
                    return (0, response_1.jsonValidationError)(res, error.message, error.errors);
                }
                return (0, response_1.jsonError)(res, error.message, error.statusCode, error.code);
            }
            const err = error;
            const statusCode = error.statusCode ||
                (error.code === "SQLITE_ERROR" ? 500 : 500);
            Logger_1.default.error("Unhandled request error", {
                err: err,
                path: req.path,
                method: req.method,
                statusCode,
                userAgent: req.headers["user-agent"],
            });
            return (0, response_1.jsonError)(res, isDevelopment ? err.message : "Internal Server Error", statusCode, error.code);
        });
    }
    setupSignalHandlers() {
        process.on("SIGTERM", () => this.gracefulShutdown("SIGTERM", 0));
        process.on("SIGINT", () => this.gracefulShutdown("SIGINT", 0));
        process.on("uncaughtException", async (error) => {
            Logger_1.default.fatal("Uncaught exception", error);
            await this.gracefulShutdown("uncaughtException", 1);
        });
        process.on("unhandledRejection", async (reason) => {
            Logger_1.default.fatal("Unhandled promise rejection", { reason });
            await this.gracefulShutdown("unhandledRejection", 1);
        });
    }
    async gracefulShutdown(signal, exitCode = 0) {
        if (this.isShuttingDown) {
            Logger_1.default.warn("Shutdown already in progress, ignoring signal", { signal });
            return;
        }
        this.isShuttingDown = true;
        const timeoutMs = this.options.shutdownTimeout;
        Logger_1.default.info(`${signal} received, starting graceful shutdown...`);
        console.log(`\n⏳ Shutting down gracefully (max ${timeoutMs / 1000}s)...`);
        const forceExitTimeout = setTimeout(() => {
            Logger_1.default.error("Graceful shutdown timeout exceeded, forcing exit");
            console.log("❌ Shutdown timeout exceeded, forcing exit");
            process.exit(exitCode || 1);
        }, timeoutMs);
        try {
            Logger_1.default.info("Closing server (stop accepting new connections)...");
            await this.server.close();
            Logger_1.default.info("Server closed successfully");
            Logger_1.default.info("Closing database connections...");
            const DB = (await Promise.resolve().then(() => __importStar(require("@services/DB")))).default;
            await DB.destroy();
            Logger_1.default.info("Database connections closed");
            Logger_1.default.info("Flushing logs...");
            await Logger_1.default.flush();
            clearTimeout(forceExitTimeout);
            console.log("✅ Graceful shutdown complete");
            process.exit(exitCode);
        }
        catch (error) {
            Logger_1.default.error("Error during graceful shutdown", error);
            clearTimeout(forceExitTimeout);
            process.exit(exitCode || 1);
        }
    }
    use(...args) {
        this.server.use(...args);
        return this;
    }
    mount(router, prefix) {
        if (prefix) {
            this.server.use(prefix, router);
        }
        else {
            this.server.use(router);
        }
        return this;
    }
    async start() {
        if (this.isStarted) {
            Logger_1.default.warn("Server already started");
            return;
        }
        const port = this.options.port;
        try {
            await this.server.listen(port);
            this.isStarted = true;
            const envSummary = (0, _config_1.getEnvSummary)(this.env);
            Logger_1.default.info("Server started successfully", {
                ...envSummary,
                nodeVersion: process.version,
            });
            const protocol = this.options.https ? "https" : "http";
            console.log(`\n🚀 Server is running at ${protocol}://localhost:${port}\n`);
        }
        catch (err) {
            Logger_1.default.fatal("Failed to start server", err);
            process.exit(1);
        }
    }
    async close() {
        await this.gracefulShutdown("close", 0);
    }
    getServer() {
        return this.server;
    }
    getEnv() {
        return this.env;
    }
    isRunning() {
        return this.isStarted && !this.isShuttingDown;
    }
}
exports.NaraApp = NaraApp;
function createApp(options) {
    return new NaraApp(options);
}
//# sourceMappingURL=App.js.map