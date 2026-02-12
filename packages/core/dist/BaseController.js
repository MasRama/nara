"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseController = void 0;
class BaseController {
    json(res, data, status = 200) {
        return res.status(status).json(data);
    }
    success(res, data, message = 'Success') {
        return res.json({ success: true, message, data });
    }
    error(res, message, status = 400) {
        return res.status(status).json({ success: false, message });
    }
}
exports.BaseController = BaseController;
//# sourceMappingURL=BaseController.js.map