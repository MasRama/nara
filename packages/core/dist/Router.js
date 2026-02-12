"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaraRouter = void 0;
exports.createRouter = createRouter;
const hyper_express_1 = __importDefault(require("hyper-express"));
class NaraRouter {
    constructor(prefix = '') {
        this.router = new hyper_express_1.default.Router();
        this.prefix = prefix;
    }
    get(path, ...handlers) {
        this.router.get(this.prefix + path, ...handlers);
        return this;
    }
    post(path, ...handlers) {
        this.router.post(this.prefix + path, ...handlers);
        return this;
    }
    put(path, ...handlers) {
        this.router.put(this.prefix + path, ...handlers);
        return this;
    }
    patch(path, ...handlers) {
        this.router.patch(this.prefix + path, ...handlers);
        return this;
    }
    delete(path, ...handlers) {
        this.router.delete(this.prefix + path, ...handlers);
        return this;
    }
    group(callback) {
        callback(this);
        return this;
    }
    getRouter() {
        return this.router;
    }
}
exports.NaraRouter = NaraRouter;
function createRouter(prefix) {
    return new NaraRouter(prefix);
}
//# sourceMappingURL=Router.js.map