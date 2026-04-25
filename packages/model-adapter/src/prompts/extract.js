"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTRACTION_SYSTEM_PROMPT = void 0;
exports.buildExtractionPrompt = buildExtractionPrompt;
exports.EXTRACTION_SYSTEM_PROMPT = `You are a data extraction assistant. Extract structured data from the provided content according to the JSON schema.
Return ONLY valid JSON matching the schema. Do not include any explanation or markdown formatting.
For fields you cannot find in the content, use null.
For each extracted field, you MUST include a confidence score between 0 and 1 and a source quote from the content.`;
function buildExtractionPrompt(markdown, schemaJson) {
    return `Extract data from the following content according to this JSON schema:\n\n${schemaJson}\n\nContent:\n${markdown}`;
}
//# sourceMappingURL=extract.js.map