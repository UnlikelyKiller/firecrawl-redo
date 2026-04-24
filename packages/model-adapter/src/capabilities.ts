import type { ModelCapability } from './adapter.js';

export const KIMI_K2_CAPABILITIES: ReadonlySet<ModelCapability> = new Set(['text', 'json', 'long_context']);
export const OLLAMA_DEFAULT_CAPABILITIES: ReadonlySet<ModelCapability> = new Set(['text', 'json', 'cheap']);
export const OPENAI_COMPAT_CAPABILITIES: ReadonlySet<ModelCapability> = new Set(['text', 'vision', 'json', 'tools']);