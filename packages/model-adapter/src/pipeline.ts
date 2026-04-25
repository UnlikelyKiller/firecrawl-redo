import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';
import type { ExtractionResult, AdapterError, ModelAdapter, LLMLogger } from './adapter.js';
import { ModelRouter } from './router.js';
import { RouterError } from './router.js';

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError?: z.ZodError | AdapterError,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export interface ExtractionOptions {
  readonly maxRepairAttempts: number;
  readonly model?: string;
  readonly logger?: LLMLogger;
  readonly jobId?: string;
}

const DEFAULT_OPTIONS: ExtractionOptions = { maxRepairAttempts: 2 };

export class ExtractionPipeline {
  constructor(
    private readonly router: ModelRouter,
    private readonly options: ExtractionOptions = DEFAULT_OPTIONS,
  ) {}

  async extract(
    markdown: string,
    schema: z.ZodType,
    options?: Partial<ExtractionOptions>,
  ): Promise<Result<ExtractionResult, ExtractionError>> {
    const opts = { ...this.options, ...options };

    const selection = this.router.selectForText();
    if (selection.isErr()) {
      return err(new ExtractionError(
        `No model available: ${selection.error.message}`,
        0,
        undefined,
      ));
    }

    const model = selection.value;
    if (opts.logger) {
      model.setLogger(opts.logger);
    }

    let attempt = 0;

    attempt += 1;
    const extractResult = await model.extractJson(markdown, schema);
    if (extractResult.isOk()) {
      return ok(extractResult.value);
    }

    if (extractResult.error.code !== 'INVALID_RESPONSE') {
      return err(new ExtractionError(
        `Extraction failed: ${extractResult.error.message}`,
        attempt,
        extractResult.error,
      ));
    }

    const zodError = extractResult.error.cause instanceof z.ZodError
      ? extractResult.error.cause
      : undefined;

    const rawResponse = extractResult.error.rawResponse ?? '{}';

    if (!zodError) {
      return err(new ExtractionError(
        `Extraction failed with INVALID_RESPONSE but no ZodError details`,
        attempt,
        extractResult.error,
      ));
    }

    let lastZodError: z.ZodError = zodError;
    let lastRawJson = rawResponse;

    for (let i = 0; i < opts.maxRepairAttempts; i += 1) {
      attempt += 1;
      const repairResult = await model.repairJson(lastRawJson, lastZodError, schema);
      if (repairResult.isOk()) {
        return ok(repairResult.value);
      }

      if (repairResult.error.code !== 'INVALID_RESPONSE') {
        return err(new ExtractionError(
          `Repair attempt ${attempt} failed: ${repairResult.error.message}`,
          attempt,
          repairResult.error,
        ));
      }

      if (repairResult.error.cause instanceof z.ZodError) {
        lastZodError = repairResult.error.cause;
      }
      lastRawJson = repairResult.error.rawResponse ?? lastRawJson;
    }

    return err(new ExtractionError(
      `Extraction failed after ${attempt} attempts`,
      attempt,
      lastZodError,
    ));
  }
}