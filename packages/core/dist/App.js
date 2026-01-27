"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaraApp = void 0;
exports.createApp = createApp;
const hyper_express_1 = __importDefault(require("hyper-express"));
class NaraApp {
    constructor(options = {}) {
        this.server = new hyper_express_1.default.Server();
        this.port = options.port || 3000;
        this.adapter = options.adapter;
        if (this.adapter) {
            this.server.use(this.adapter.middleware());
        }
    }
    use(middleware) {
        this.server.use(middleware);
        return this;
    }
    get(path, ...handlers) {
        this.server.get(path, ...handlers);
        return this;
    }
    post(path, ...handlers) {
        this.server.post(path, ...handlers);
        return this;
    }
    put(path, ...handlers) {
        this.server.put(path, ...handlers);
        return this;
    }
    patch(path, ...handlers) {
        this.server.patch(path, ...handlers);
        return this;
    }
    delete(path, ...handlers) {
        this.server.delete(path, ...handlers);
        return this;
    }
    async start() {
        await this.server.listen(this.port);
        console.log(`🚀 Server running on http://localhost:${this.port}`);
    }
    getServer() {
        return this.server;
    }
}
exports.NaraApp = NaraApp;
function createApp(options) {
    return new NaraApp(options);
}
//# sourceMappingURL=App.js.map