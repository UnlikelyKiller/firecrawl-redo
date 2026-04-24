import { describe, it, expect } from 'vitest';
import { diffSchema } from '../schema-diff.js';

describe('diffSchema', () => {
  it('returns no changes for identical data', () => {
    const data = { title: 'Hello', count: 5 };
    const result = diffSchema(data, data);
    expect(result.hasChanges).toBe(false);
    expect(result.fieldChanges).toHaveLength(0);
  });

  it('detects added field', () => {
    const oldData = { title: 'Hello' };
    const newData = { title: 'Hello', author: 'World' };
    const result = diffSchema(oldData, newData);
    expect(result.hasChanges).toBe(true);
    expect(result.addedFields).toBe(1);
    const added = result.fieldChanges.find((c) => c.changeType === 'added');
    expect(added).toBeDefined();
    expect(added!.field).toBe('author');
    expect(added!.newValue).toBe('World');
  });

  it('detects removed field', () => {
    const oldData = { title: 'Hello', author: 'World' };
    const newData = { title: 'Hello' };
    const result = diffSchema(oldData, newData);
    expect(result.hasChanges).toBe(true);
    expect(result.removedFields).toBe(1);
    const removed = result.fieldChanges.find((c) => c.changeType === 'removed');
    expect(removed).toBeDefined();
    expect(removed!.field).toBe('author');
    expect(removed!.oldValue).toBe('World');
  });

  it('detects changed field', () => {
    const oldData = { title: 'Old Title' };
    const newData = { title: 'New Title' };
    const result = diffSchema(oldData, newData);
    expect(result.hasChanges).toBe(true);
    expect(result.changedFields).toBe(1);
    const changed = result.fieldChanges.find((c) => c.changeType === 'changed');
    expect(changed).toBeDefined();
    expect(changed!.field).toBe('title');
    expect(changed!.oldValue).toBe('Old Title');
    expect(changed!.newValue).toBe('New Title');
  });

  it('compares only top-level fields for nested objects', () => {
    const oldData = { meta: { a: 1, b: 2 } };
    const newData = { meta: { a: 1, b: 3 } };
    const result = diffSchema(oldData, newData);
    expect(result.hasChanges).toBe(true);
    expect(result.changedFields).toBe(1);
  });

  it('filters changes by confidence threshold', () => {
    const oldData = { title: 'The quick brown fox jumps over the lazy dog' };
    const newData = { title: 'The quick brown fox leaps over the lazy dog' };

    const resultLow = diffSchema(oldData, newData, 0.0);
    const resultHigh = diffSchema(oldData, newData, 0.99);

    expect(resultLow.fieldChanges.length).toBeGreaterThanOrEqual(1);
    expect(resultHigh.fieldChanges.length).toBeLessThanOrEqual(resultLow.fieldChanges.length);
  });

  it('does not report change for identical field values', () => {
    const oldData = { title: 'Same', count: 42 };
    const newData = { title: 'Same', count: 42 };
    const result = diffSchema(oldData, newData);
    expect(result.hasChanges).toBe(false);
  });

  it('detects multiple field changes simultaneously', () => {
    const oldData = { title: 'Old', author: 'Alice' };
    const newData = { title: 'New', author: 'Alice', year: 2024 };
    const result = diffSchema(oldData, newData);
    expect(result.hasChanges).toBe(true);
    expect(result.changedFields).toBe(1);
    expect(result.addedFields).toBe(1);
  });
});