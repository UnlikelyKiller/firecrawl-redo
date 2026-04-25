import { ok, err, type Result } from 'neverthrow';
import { z } from 'zod';
import type { ModelAdapter, ModelCapability, ExtractionResult, RelevanceScore, LLMLogger } from './adapter.js';
import { AdapterError } from './adapter.js';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt } from './prompts/extract.js';
import { REPAIR_SYSTEM_PROMPT, buildRepairPrompt } from './prompts/repair.js';
import { CLASSIFY_SYSTEM_PROMPT, buildClassifyPrompt } from './prompts/classify.js';

export interface OllamaOptions {
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs?: number;
}

interface OllamaChatResponse {
  readonly message: { readonly content: string };
}

export class OllamaAdapter implements ModelAdapter {
  readonly name: string;
  readonly capabilities: ReadonlySet<ModelCapability>;
  private logger?: LLMLogger;

  constructor(private readonly options: OllamaOptions) {
    this.name = `ollama:${options.model}`;
    this.capabilities = new Set(['text', 'json', 'cheap'] as const satisfies ReadonlyArray<ModelCapability>);
  }

  setLogger(logger: LLMLogger): void {
    this.logger = logger;
  }

  async extractJson(markdown: string, schema: z.ZodType): Promise<Result<ExtractionResult, AdapterError>> {
    const schemaJson = JSON.stringify(schema._def ?? {});
    const userPrompt = buildExtractionPrompt(markdown, schemaJson);

    const response = await this.chat(EXTRACTION_SYSTEM_PROMPT, userPrompt);
    if (response.isErr()) return err(response.error);

    const parsed = this.parseJson(response.value);
    if (parsed.isErr()) return err(parsed.error);

    const validated = schema.safeParse(parsed.value);
    if (!validated.success) {
      return err(new AdapterError(
        `Schema validation failed: ${validated.error.message}`,
        'INVALID_RESPONSE',
        validated.error,
        response.value,
      ));
    }

    return ok({
      data: validated.data as Record<string, unknown>,
      confidence: this.computeConfidence(parsed.value),
      sourceQuotes: this.extractSourceQuotes(parsed.value),
      nullFields: this.findNullFields(parsed.value),
    });
  }

  async repairJson(invalid: string, errors: z.ZodError, schema: z.ZodType): Promise<Result<ExtractionResult, AdapterError>> {
    const schemaJson = JSON.stringify(schema._def ?? {});
    const errorMessages = errors.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
    const userPrompt = buildRepairPrompt(invalid, errorMessages, schemaJson);

    const response = await this.chat(REPAIR_SYSTEM_PROMPT, userPrompt);
    if (response.isErr()) return err(response.error);

    const parsed = this.parseJson(response.value);
    if (parsed.isErr()) return err(parsed.error);

    const validated = schema.safeParse(parsed.value);
    if (!validated.success) {
      return err(new AdapterError(
        `Repair failed — schema still invalid: ${validated.error.message}`,
        'INVALID_RESPONSE',
        validated.error,
        response.value,
      ));
    }

    return ok({
      data: validated.data as Record<string, unknown>,
      confidence: this.computeConfidence(parsed.value) * 0.9,
      sourceQuotes: this.extractSourceQuotes(parsed.value),
      nullFields: this.findNullFields(parsed.value),
    });
  }

  async classifyPageRelevance(markdown: string, task: string): Promise<Result<RelevanceScore, AdapterError>> {
    const userPrompt = buildClassifyPrompt(markdown, task);

    const response = await this.chat(CLASSIFY_SYSTEM_PROMPT, userPrompt);
    if (response.isErr()) return err(response.error);

    const parsed = this.parseJson(response.value);
    if (parsed.isErr()) return err(parsed.error);

    const score = typeof parsed.value.score === 'number' ? parsed.value.score : 0;
    const reason = typeof parsed.value.reason === 'string' ? parsed.value.reason : '';

    return ok({ score: Math.max(0, Math.min(1, score)), reason });
  }

  private async chat(system: string, user: string): Promise<Result<string, AdapterError>> {
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
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 30_000,
    );

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
          return err(new AdapterError('Rate limited by Ollama', 'RATE_LIMITED'));
        }
        return err(new AdapterError(
          `Ollama HTTP ${res.status}: ${errorText}`,
          res.status >= 500 ? 'CONNECTION_ERROR' : 'INVALID_RESPONSE',
        ));
      }

      const json = (await res.json()) as OllamaChatResponse & { prompt_eval_count?: number; eval_count?: number };
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

      return ok(content);
    } catch (e: unknown) {
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
        return err(new AdapterError('Ollama request timed out', 'TIMEOUT', e));
      }
      return err(new AdapterError(
        `Ollama connection error: ${e instanceof Error ? e.message : String(e)}`,
        'CONNECTION_ERROR',
        e,
      ));
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseJson(raw: string): Result<Record<string, unknown>, AdapterError> {
    try {
      const stripped = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(stripped) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return ok(parsed as Record<string, unknown>);
      }
      return err(new AdapterError('Model returned non-object JSON', 'INVALID_RESPONSE'));
    } catch (e: unknown) {
      return err(new AdapterError(
        `JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
        'INVALID_RESPONSE',
        e,
      ));
    }
  }

  private computeConfidence(data: Record<string, unknown>): number {
    const values = Object.values(data);
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    return values.length === 0 ? 0 : nonNull.length / values.length;
  }

  private extractSourceQuotes(data: Record<string, unknown>): ReadonlyArray<{ readonly field: string; readonly quote: string; readonly confidence: number }> {
    return Object.entries(data)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([field]) => ({ field, quote: String(data[field]), confidence: 0.8 }));
  }

  private findNullFields(data: Record<string, unknown>): ReadonlyArray<string> {
    return Object.entries(data)
      .filter(([, v]) => v === null || v === undefined)
      .map(([k]) => k);
  }
}
