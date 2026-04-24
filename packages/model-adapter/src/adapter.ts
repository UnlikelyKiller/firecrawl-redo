import { Result } from 'neverthrow';
import { z } from 'zod';

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: 'TIMEOUT' | 'RATE_LIMITED' | 'INVALID_RESPONSE' | 'CONNECTION_ERROR' | 'BUDGET_EXCEEDED' | 'UNKNOWN',
    public readonly cause?: unknown,
    public readonly rawResponse?: string,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export interface SourceQuote {
  readonly field: string;
  readonly quote: string;
  readonly confidence: number;
}

export interface ExtractionResult {
  readonly data: Record<string, unknown>;
  readonly confidence: number;
  readonly sourceQuotes: ReadonlyArray<SourceQuote>;
  readonly nullFields: ReadonlyArray<string>;
}

export type ModelCapability = 'text' | 'vision' | 'tools' | 'json' | 'long_context' | 'cheap' | 'fallback';

export interface RelevanceScore {
  readonly score: number;
  readonly reason: string;
}

export interface TextExtractor {
  extractJson(markdown: string, schema: z.ZodType): Promise<Result<ExtractionResult, AdapterError>>;
}

export interface JsonRepairer {
  repairJson(invalid: string, errors: z.ZodError, schema: z.ZodType): Promise<Result<ExtractionResult, AdapterError>>;
}

export interface PageClassifier {
  classifyPageRelevance(markdown: string, task: string): Promise<Result<RelevanceScore, AdapterError>>;
}

export interface VisualAnalyzer {
  analyzeScreenshot(image: Buffer, task: string): Promise<Result<ExtractionResult, AdapterError>>;
}

export interface ModelAdapter extends TextExtractor, JsonRepairer, PageClassifier {
  readonly name: string;
  readonly capabilities: ReadonlySet<ModelCapability>;
}