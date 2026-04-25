export {
  AdapterError,
  type ExtractionResult,
  type SourceQuote,
  type ModelCapability,
  type RelevanceScore,
  type TextExtractor,
  type JsonRepairer,
  type PageClassifier,
  type VisualAnalyzer,
  type ModelAdapter,
  type LLMLogger,
  type LLMUsage,
} from './adapter.js';

export {
  ModelRouter,
  RouterError,
} from './router.js';

export {
  KIMI_K2_CAPABILITIES,
  OLLAMA_DEFAULT_CAPABILITIES,
  OPENAI_COMPAT_CAPABILITIES,
} from './capabilities.js';

export {
  OllamaAdapter,
  type OllamaOptions,
} from './ollama.js';

export {
  OpenAICompatAdapter,
  type OpenAICompatOptions,
} from './openai-compat.js';

export {
  ExtractionPipeline,
  ExtractionError,
  type ExtractionOptions,
} from './pipeline.js';

export {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  REPAIR_SYSTEM_PROMPT,
  buildRepairPrompt,
  CLASSIFY_SYSTEM_PROMPT,
  buildClassifyPrompt,
} from './prompts/index.js';