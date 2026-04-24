import { describe, it, expect } from 'vitest';
import { diffMarkdown } from '../markdown-diff.js';

describe('diffMarkdown', () => {
  it('returns no changes for identical content', () => {
    const result = diffMarkdown('# Hello\nWorld', '# Hello\nWorld');
    expect(result.hasChanges).toBe(false);
    expect(result.addedLines).toBe(0);
    expect(result.removedLines).toBe(0);
  });

  it('detects added paragraph', () => {
    const oldContent = '# Title\nParagraph 1';
    const newContent = '# Title\nParagraph 1\nParagraph 2';
    const result = diffMarkdown(oldContent, newContent);
    expect(result.hasChanges).toBe(true);
    expect(result.addedLines).toBe(1);
    const added = result.diff.filter((d) => d.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0]!.content).toBe('Paragraph 2');
  });

  it('detects removed paragraph', () => {
    const oldContent = '# Title\nParagraph 1\nParagraph 2';
    const newContent = '# Title\nParagraph 1';
    const result = diffMarkdown(oldContent, newContent);
    expect(result.hasChanges).toBe(true);
    expect(result.removedLines).toBe(1);
    const removed = result.diff.filter((d) => d.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0]!.content).toBe('Paragraph 2');
  });

  it('detects changed line', () => {
    const oldContent = '# Title\nOld line';
    const newContent = '# Title\nNew line';
    const result = diffMarkdown(oldContent, newContent);
    expect(result.hasChanges).toBe(true);
    expect(result.removedLines).toBe(1);
    expect(result.addedLines).toBe(1);
  });

  it('detects multiple changes in same document', () => {
    const oldContent = '# Title\nAlpha\nBeta\nGamma';
    const newContent = '# Title\nAlpha\nChanged\nGamma\nDelta';
    const result = diffMarkdown(oldContent, newContent);
    expect(result.hasChanges).toBe(true);
    expect(result.addedLines).toBeGreaterThanOrEqual(1);
    expect(result.removedLines).toBeGreaterThanOrEqual(1);
  });

  it('produces unified patch format output', () => {
    const oldContent = '# Title\nParagraph 1';
    const newContent = '# Title\nParagraph 1\nParagraph 2';
    const result = diffMarkdown(oldContent, newContent);
    expect(result.unifiedPatch).toContain('--- a/content.md');
    expect(result.unifiedPatch).toContain('+++ b/content.md');
    expect(result.unifiedPatch).toContain('+Paragraph 2');
  });

  it('treats empty old content as all lines added', () => {
    const result = diffMarkdown('', 'Line 1\nLine 2\nLine 3');
    expect(result.hasChanges).toBe(true);
    expect(result.addedLines).toBe(3);
    expect(result.removedLines).toBe(0);
  });

  it('treats empty new content as all lines removed', () => {
    const result = diffMarkdown('Line 1\nLine 2\nLine 3', '');
    expect(result.hasChanges).toBe(true);
    expect(result.removedLines).toBe(3);
    expect(result.addedLines).toBe(0);
  });

  it('returns empty diff and patch for identical strings', () => {
    const result = diffMarkdown('same content', 'same content');
    expect(result.diff).toHaveLength(0);
    expect(result.unifiedPatch).toBe('');
  });
});