"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterError = void 0;
class AdapterError extends Error {
    code;
    cause;
    rawResponse;
    constructor(message, code, cause, rawResponse) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.rawResponse = rawResponse;
        this.name = 'AdapterError';
    }
}
exports.AdapterError = AdapterError;
//# sourceMappingURL=adapter.js.map