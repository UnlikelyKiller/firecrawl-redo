import { describe, it, expect } from 'vitest';
import { ChangeTracker, type ChangeSnapshot } from '../tracker.js';
import { ContentAddressedStore } from '../../../artifact-store/src/index.js';

function makeSnapshot(url: string, hash: string): ChangeSnapshot {
  return { url, contentHash: hash, timestamp: new Date() };
}

describe('ChangeTracker', () => {
  const store = new ContentAddressedStore('/tmp/test-artifacts');
  const tracker = new ChangeTracker(store);

  it('detects hash change', async () => {
    const result = await tracker.compareHashes('hash-a', 'hash-b');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(true);
  });

  it('returns no change for identical hashes', async () => {
    const result = await tracker.compareHashes('same-hash', 'same-hash');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(false);
  });

  it('computes markdown diff when hashes differ', async () => {
    const prev = makeSnapshot('https://example.com', 'hash-old');
    const curr = makeSnapshot('https://example.com', 'hash-new');
    const result = await tracker.detectChange(
      'https://example.com',
      prev,
      curr,
      '# Title\nOld paragraph',
      '# Title\nNew paragraph',
    );
    expect(result.isOk()).toBe(true);
    const diff = result._unsafeUnwrap();
    expect(diff.changed).toBe(true);
    expect(diff.hashDiff).not.toBeNull();
    expect(diff.hashDiff!.old).toBe('hash-old');
    expect(diff.hashDiff!.new).toBe('hash-new');
    expect(diff.markdownDiff).not.toBeNull();
    expect(diff.markdownDiff).toContain('--- a/content.md');
  });

  it('returns no change when hashes are identical', async () => {
    const prev = makeSnapshot('https://example.com', 'same-hash');
    const curr = makeSnapshot('https://example.com', 'same-hash');
    const result = await tracker.detectChange('https://example.com', prev, curr);
    expect(result.isOk()).toBe(true);
    const diff = result._unsafeUnwrap();
    expect(diff.changed).toBe(false);
    expect(diff.hashDiff).toBeNull();
    expect(diff.markdownDiff).toBeNull();
    expect(diff.fieldChanges).toBeNull();
  });

  it('computes field changes when schemas provided', async () => {
    const prev = makeSnapshot('https://example.com', 'hash-old');
    const curr = makeSnapshot('https://example.com', 'hash-new');
    const result = await tracker.detectChange(
      'https://example.com',
      prev,
      curr,
      'old markdown',
      'new markdown',
      { title: 'Old Title', author: 'Alice' },
      { title: 'New Title', author: 'Alice', year: 2024 },
    );
    expect(result.isOk()).toBe(true);
    const diff = result._unsafeUnwrap();
    expect(diff.changed).toBe(true);
    expect(diff.fieldChanges).not.toBeNull();
    expect(diff.fieldChanges!.length).toBeGreaterThanOrEqual(1);
  });

  it('skips markdown diff when markdown not provided', async () => {
    const prev = makeSnapshot('https://example.com', 'hash-old');
    const curr = makeSnapshot('https://example.com', 'hash-new');
    const result = await tracker.detectChange('https://example.com', prev, curr);
    expect(result.isOk()).toBe(true);
    const diff = result._unsafeUnwrap();
    expect(diff.changed).toBe(true);
    expect(diff.markdownDiff).toBeNull();
  });
});