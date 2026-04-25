"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPAIR_SYSTEM_PROMPT = void 0;
exports.buildRepairPrompt = buildRepairPrompt;
exports.REPAIR_SYSTEM_PROMPT = `You are a JSON repair assistant. The provided JSON does not match the required schema.
Fix the JSON to match the schema. Return ONLY valid JSON. Do not include explanations.`;
function buildRepairPrompt(invalidJson, errors, schemaJson) {
    return `The following JSON has validation errors:\n\n${invalidJson}\n\nErrors:\n${errors}\n\nFix it to match this schema:\n${schemaJson}`;
}
//# sourceMappingURL=repair.js.map