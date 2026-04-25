"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRouter = exports.RouterError = void 0;
const neverthrow_1 = require("neverthrow");
class RouterError extends Error {
    required;
    constructor(message, required) {
        super(message);
        this.required = required;
        this.name = 'RouterError';
    }
}
exports.RouterError = RouterError;
const CAPABILITY_PREFERENCE = ['cheap', 'text', 'json', 'vision', 'tools', 'long_context', 'fallback'];
function capabilitySortKey(model) {
    let key = 0;
    for (const cap of CAPABILITY_PREFERENCE) {
        if (model.capabilities.has(cap)) {
            key += 1;
        }
    }
    return key;
}
class ModelRouter {
    models;
    constructor(models) {
        this.models = models;
    }
    selectForCapabilities(required) {
        const candidates = this.models.filter((m) => required.every((cap) => m.capabilities.has(cap)));
        if (candidates.length === 0) {
            return (0, neverthrow_1.err)(new RouterError(`No model found with required capabilities: ${required.join(', ')}`, required));
        }
        const sorted = [...candidates].sort((a, b) => {
            const aIsCheap = a.capabilities.has('cheap') ? 0 : 1;
            const bIsCheap = b.capabilities.has('cheap') ? 0 : 1;
            if (aIsCheap !== bIsCheap)
                return aIsCheap - bIsCheap;
            const aIsFallback = a.capabilities.has('fallback') ? 1 : 0;
            const bIsFallback = b.capabilities.has('fallback') ? 1 : 0;
            if (aIsFallback !== bIsFallback)
                return aIsFallback - bIsFallback;
            return capabilitySortKey(a) - capabilitySortKey(b);
        });
        return (0, neverthrow_1.ok)(sorted[0]);
    }
    selectForText() {
        return this.selectForCapabilities(['text', 'json']);
    }
    selectForVision() {
        return this.selectForCapabilities(['text', 'vision', 'json']);
    }
    selectForClassification() {
        const cheap = this.selectForCapabilities(['text', 'cheap']);
        if (cheap.isOk())
            return cheap;
        return this.selectForCapabilities(['text']);
    }
}
exports.ModelRouter = ModelRouter;
//# sourceMappingURL=router.js.map