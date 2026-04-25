# Plan: Track 4 - ModelAdapter + Structured Extraction

### Phase 1: Adapter and Router Planning
- [ ] Task 1.1: Define `ModelAdapter` capability interfaces and shared extraction types.
- [ ] Task 1.2: Define `ModelRouter` routing rules for text, vision, JSON, long-context, and fallback cases.
- [ ] Task 1.3: Define provider boundaries for Ollama and OpenAI-compatible backends.

### Phase 2: Extraction Pipeline Planning
- [ ] Task 2.1: Define the three-pass extraction pipeline: extract, validate, repair.
- [ ] Task 2.2: Define prompt versioning, source-quote handling, and nullability rules.
- [ ] Task 2.3: Define how browser receipts and structured page reads become extraction inputs.

### Phase 3: Verification Plan
- [ ] Task 3.1: Define contract tests for adapters.
- [ ] Task 3.2: Define extraction pipeline tests for success, repair, and failure paths.
- [ ] Task 3.3: Define prompt-injection and schema-validation tests.
