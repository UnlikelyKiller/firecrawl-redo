import { Result, ok, err } from 'neverthrow';
import { ContentAddressedStore } from '../../artifact-store/src/index.js';
import { compareContentHashes, type HashDiffResult } from './hash-diff.js';
import { diffMarkdown, type MarkdownDiffResult } from './markdown-diff.js';
import { diffSchema, type SchemaDiffResult, type SchemaFieldDiff } from './schema-diff.js';

export interface ChangeSnapshot {
  readonly url: string;
  readonly contentHash: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface FieldChange {
  readonly field: string;
  readonly old: unknown;
  readonly new: unknown;
  readonly confidence: number;
}

export interface ChangeDiff {
  readonly url: string;
  readonly changed: boolean;
  readonly hashDiff: { readonly old: string; readonly new: string } | null;
  readonly markdownDiff: string | null;
  readonly fieldChanges: ReadonlyArray<FieldChange> | null;
  readonly previousSnapshot: string;
  readonly currentSnapshot: string;
  readonly detectedAt: Date;
}

export class ChangeTracker {
  constructor(private readonly store: ContentAddressedStore) {}

  async compareHashes(previous: string, current: string): Promise<Result<boolean, Error>> {
    const result = compareContentHashes(previous, current);
    return ok(result.changed);
  }

  async detectChange(
    url: string,
    previousSnapshot: ChangeSnapshot,
    currentSnapshot: ChangeSnapshot,
    oldMarkdown?: string,
    newMarkdown?: string,
    oldSchema?: Record<string, unknown>,
    newSchema?: Record<string, unknown>,
  ): Promise<Result<ChangeDiff, Error>> {
    const hashResult: HashDiffResult = compareContentHashes(
      previousSnapshot.contentHash,
      currentSnapshot.contentHash,
    );

    if (!hashResult.changed) {
      return ok({
        url,
        changed: false,
        hashDiff: null,
        markdownDiff: null,
        fieldChanges: null,
        previousSnapshot: previousSnapshot.contentHash,
        currentSnapshot: currentSnapshot.contentHash,
        detectedAt: new Date(),
      });
    }

    let markdownDiffResult: MarkdownDiffResult | null = null;
    if (oldMarkdown !== undefined && newMarkdown !== undefined) {
      markdownDiffResult = diffMarkdown(oldMarkdown, newMarkdown);
    }

    let schemaDiffResult: SchemaDiffResult | null = null;
    if (oldSchema !== undefined && newSchema !== undefined) {
      schemaDiffResult = diffSchema(oldSchema, newSchema);
    }

    const fieldChanges: FieldChange[] | null = schemaDiffResult
      ? schemaDiffResult.fieldChanges.map((fc: SchemaFieldDiff) => ({
          field: fc.field,
          old: fc.oldValue,
          new: fc.newValue,
          confidence: fc.confidence,
        }))
      : null;

    return ok({
      url,
      changed: true,
      hashDiff: { old: hashResult.oldHash, new: hashResult.newHash },
      markdownDiff: markdownDiffResult?.unifiedPatch ?? null,
      fieldChanges,
      previousSnapshot: previousSnapshot.contentHash,
      currentSnapshot: currentSnapshot.contentHash,
      detectedAt: new Date(),
    });
  }
}