import { err, ok, type Result } from 'neverthrow';
import type { ModelAdapter, ModelCapability } from './adapter.js';

export class RouterError extends Error {
  constructor(
    message: string,
    public readonly required: ReadonlyArray<ModelCapability>,
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

const CAPABILITY_PREFERENCE: ReadonlyArray<ModelCapability> = ['cheap', 'text', 'json', 'vision', 'tools', 'long_context', 'fallback'];

function capabilitySortKey(model: ModelAdapter): number {
  let key = 0;
  for (const cap of CAPABILITY_PREFERENCE) {
    if (model.capabilities.has(cap)) {
      key += 1;
    }
  }
  return key;
}

export class ModelRouter {
  constructor(private readonly models: ReadonlyArray<ModelAdapter>) {}

  selectForCapabilities(required: ReadonlyArray<ModelCapability>): Result<ModelAdapter, RouterError> {
    const candidates = this.models.filter((m) =>
      required.every((cap) => m.capabilities.has(cap)),
    );

    if (candidates.length === 0) {
      return err(new RouterError(
        `No model found with required capabilities: ${required.join(', ')}`,
        required,
      ));
    }

    const sorted = [...candidates].sort((a, b) => {
      const aIsCheap = a.capabilities.has('cheap') ? 0 : 1;
      const bIsCheap = b.capabilities.has('cheap') ? 0 : 1;
      if (aIsCheap !== bIsCheap) return aIsCheap - bIsCheap;

      const aIsFallback = a.capabilities.has('fallback') ? 1 : 0;
      const bIsFallback = b.capabilities.has('fallback') ? 1 : 0;
      if (aIsFallback !== bIsFallback) return aIsFallback - bIsFallback;

      return capabilitySortKey(a) - capabilitySortKey(b);
    });

    return ok(sorted[0]!);
  }

  selectForText(): Result<ModelAdapter, RouterError> {
    return this.selectForCapabilities(['text', 'json']);
  }

  selectForVision(): Result<ModelAdapter, RouterError> {
    return this.selectForCapabilities(['text', 'vision', 'json']);
  }

  selectForClassification(): Result<ModelAdapter, RouterError> {
    const cheap = this.selectForCapabilities(['text', 'cheap']);
    if (cheap.isOk()) return cheap;
    return this.selectForCapabilities(['text']);
  }
}