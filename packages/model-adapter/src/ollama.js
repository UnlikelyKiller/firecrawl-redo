"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaAdapter = void 0;
const neverthrow_1 = require("neverthrow");
const adapter_js_1 = require("./adapter.js");
const extract_js_1 = require("./prompts/extract.js");
const repair_js_1 = require("./prompts/repair.js");
const classify_js_1 = require("./prompts/classify.js");
class OllamaAdapter {
    options;
    name;
    capabilities;
    logger;
    constructor(options) {
        this.options = options;
        this.name = `ollama:${options.model}`;
        this.capabilities = new Set(['text', 'json', 'cheap']);
    }
    setLogger(logger) {
        this.logger = logger;
    }
    async extractJson(markdown, schema) {
        const schemaJson = JSON.stringify(schema._def ?? {});
        const userPrompt = (0, extract_js_1.buildExtractionPrompt)(markdown, schemaJson);
        const response = await this.chat(extract_js_1.EXTRACTION_SYSTEM_PROMPT, userPrompt);
        if (response.isErr())
            return (0, neverthrow_1.err)(response.error);
        const parsed = this.parseJson(response.value);
        if (parsed.isErr())
            return (0, neverthrow_1.err)(parsed.error);
        const validated = schema.safeParse(parsed.value);
        if (!validated.success) {
            return (0, neverthrow_1.err)(new adapter_js_1.AdapterError(`Schema validation failed: ${validated.error.message}`, 'INVALID_RESPONSE', validated.error, response.value));
        }
        return (0, neverthrow_1.ok)({
            data: validated.data,
            confidence: this.computeConfidence(parsed.value),
            sourceQuotes: this.extractSourceQuotes(parsed.value),
            nullFields: this.findNullFields(parsed.value),
        });
    }
    async repairJson(invalid, errors, schema) {
        const schemaJson = JSON.stringify(schema._def ?? {});
        const errorMessages = errors.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
        const userPrompt = (0, repair_js_1.buildRepairPrompt)(invalid, errorMessages, schemaJson);
        const response = await this.chat(repair_js_1.REPAIR_SYSTEM_PROMPT, userPrompt);
        if (response.isErr())
            return (0, neverthrow_1.err)(response.error);
        const parsed = this.parseJson(response.value);
        if (parsed.isErr())
            return (0, neverthrow_1.err)(parsed.error);
        const validated = schema.safeParse(parsed.value);
        if (!validated.success) {
            return (0, neverthrow_1.err)(new adapter_js_1.AdapterError(`Repair failed — schema still invalid: ${validated.error.message}`, 'INVALID_RESPONSE', validated.error, response.value));
        }
        return (0, neverthrow_1.ok)({
            data: validated.data,
            confidence: this.computeConfidence(parsed.value) * 0.9,
            sourceQuotes: this.extractSourceQuotes(parsed.value),
            nullFields: this.findNullFields(parsed.value),
        });
    }
    async classifyPageRelevance(markdown, task) {
        const userPrompt = (0, classify_js_1.buildClassifyPrompt)(markdown, task);
        const response = await this.chat(classify_js_1.CLASSIFY_SYSTEM_PROMPT, userPrompt);
        if (response.isErr())
            return (0, neverthrow_1.err)(response.error);
        const parsed = this.parseJson(response.value);
        if (parsed.isErr())
            return (0, neverthrow_1.err)(parsed.error);
        const score = typeof parsed.value.score === 'number' ? parsed.value.score : 0;
        const reason = typeof parsed.value.reason === 'string' ? parsed.value.reason : '';
        return (0, neverthrow_1.ok)({ score: Math.max(0, Math.min(1, score)), reason });
    }
    async chat(system, user) {
        const start = Date.now();
        const url = `${this.options.baseUrl}/api/chat`;
        const body = JSON.stringify({
            model: this.options.model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            stream: false,
            format: 'json',
        });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30_000);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: controller.signal,
            });
            if (!res.ok) {
                const errorText = await res.text().catch(() => 'unknown');
                if (res.status === 429) {
                    return (0, neverthrow_1.err)(new adapter_js_1.AdapterError('Rate limited by Ollama', 'RATE_LIMITED'));
                }
                return (0, neverthrow_1.err)(new adapter_js_1.AdapterError(`Ollama HTTP ${res.status}: ${errorText}`, res.status >= 500 ? 'CONNECTION_ERROR' : 'INVALID_RESPONSE'));
            }
            const json = (await res.json());
            const content = json.message.content;
            const latencyMs = Date.now() - start;
            const usage = {
                promptTokens: json.prompt_eval_count ?? 0,
                completionTokens: json.eval_count ?? 0,
                totalTokens: (json.prompt_eval_count ?? 0) + (json.eval_count ?? 0),
                latencyMs,
            };
            if (this.logger) {
                await this.logger.logCall({
                    model: this.options.model,
                    system,
                    user,
                    response: content,
                    usage,
                });
            }
            return (0, neverthrow_1.ok)(content);
        }
        catch (e) {
            const latencyMs = Date.now() - start;
            if (this.logger) {
                await this.logger.logCall({
                    model: this.options.model,
                    system,
                    user,
                    response: '',
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs },
                    error: e instanceof Error ? e.message : String(e),
                });
            }
            if (e instanceof DOMException && e.name === 'AbortError') {
                return (0, neverthrow_1.err)(new adapter_js_1.AdapterError('Ollama request timed out', 'TIMEOUT', e));
            }
            return (0, neverthrow_1.err)(new adapter_js_1.AdapterError(`Ollama connection error: ${e instanceof Error ? e.message : String(e)}`, 'CONNECTION_ERROR', e));
        }
        finally {
            clearTimeout(timeout);
        }
    }
    parseJson(raw) {
        try {
            const stripped = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
            const parsed = JSON.parse(stripped);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                return (0, neverthrow_1.ok)(parsed);
            }
            return (0, neverthrow_1.err)(new adapter_js_1.AdapterError('Model returned non-object JSON', 'INVALID_RESPONSE'));
        }
        catch (e) {
            return (0, neverthrow_1.err)(new adapter_js_1.AdapterError(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`, 'INVALID_RESPONSE', e));
        }
    }
    computeConfidence(data) {
        const values = Object.values(data);
        const nonNull = values.filter((v) => v !== null && v !== undefined);
        return values.length === 0 ? 0 : nonNull.length / values.length;
    }
    extractSourceQuotes(data) {
        return Object.entries(data)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([field]) => ({ field, quote: String(data[field]), confidence: 0.8 }));
    }
    findNullFields(data) {
        return Object.entries(data)
            .filter(([, v]) => v === null || v === undefined)
            .map(([k]) => k);
    }
}
exports.OllamaAdapter = OllamaAdapter;
//# sourceMappingURL=ollama.js.map