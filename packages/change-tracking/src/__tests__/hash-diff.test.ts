import { describe, it, expect } from 'vitest';
import { compareContentHashes } from '../hash-diff.js';

describe('compareContentHashes', () => {
  it('returns no change for same content hash', () => {
    const hash = 'abc123def456';
    const result = compareContentHashes(hash, hash);
    expect(result.changed).toBe(false);
  });

  it('detects change for different content hashes', () => {
    const result = compareContentHashes('abc123', 'def456');
    expect(result.changed).toBe(true);
  });

  it('includes old and new hashes in result', () => {
    const result = compareContentHashes('abc123', 'def456');
    expect(result.oldHash).toBe('abc123');
    expect(result.newHash).toBe('def456');
  });

  it('returns no change for empty string hashes', () => {
    const result = compareContentHashes('', '');
    expect(result.changed).toBe(false);
  });

  it('detects change when old is empty and new is not', () => {
    const result = compareContentHashes('', 'abc');
    expect(result.changed).toBe(true);
    expect(result.oldHash).toBe('');
    expect(result.newHash).toBe('abc');
  });
});