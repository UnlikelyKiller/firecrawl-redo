export interface LineDiff {
  readonly type: 'added' | 'removed' | 'unchanged';
  readonly content: string;
  readonly lineNumber: number;
}

export interface MarkdownDiffResult {
  readonly hasChanges: boolean;
  readonly addedLines: number;
  readonly removedLines: number;
  readonly diff: ReadonlyArray<LineDiff>;
  readonly unifiedPatch: string;
}

function computeLCSLength(oldLines: ReadonlyArray<string>, newLines: ReadonlyArray<string>): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  return dp;
}

function backtrackDiff(
  dp: number[][],
  oldLines: ReadonlyArray<string>,
  newLines: ReadonlyArray<string>,
): Array<{ type: 'added' | 'removed' | 'unchanged'; oldLine?: number; newLine?: number; content: string }> {
  const result: Array<{ type: 'added' | 'removed' | 'unchanged'; oldLine?: number; newLine?: number; content: string }> = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'unchanged', oldLine: i, newLine: j, content: oldLines[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.push({ type: 'added', newLine: j, content: newLines[j - 1]! });
      j--;
    } else {
      result.push({ type: 'removed', oldLine: i, content: oldLines[i - 1]! });
      i--;
    }
  }

  return result.reverse();
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

function buildUnifiedPatch(
  oldLines: ReadonlyArray<string>,
  diffOps: ReadonlyArray<{ type: 'added' | 'removed' | 'unchanged'; oldLine?: number; newLine?: number; content: string }>,
): string {
  const output: string[] = [];
  output.push('--- a/content.md');
  output.push('+++ b/content.md');

  const hunks: Hunk[] = [];
  let activeHunk: Hunk | null = null;
  let contextCounter = 0;

  function startHunk(firstOp: { type: string; oldLine?: number; newLine?: number; content: string }): Hunk {
    const hunk: Hunk = {
      oldStart: firstOp.oldLine ?? (firstOp.newLine ?? 1),
      oldCount: 0,
      newStart: firstOp.newLine ?? (firstOp.oldLine ?? 1),
      newCount: 0,
      lines: [],
    };
    const start = Math.max(0, (firstOp.oldLine ?? 1) - 3);
    const end = (firstOp.oldLine ?? 1) - 1;
    for (let k = start; k < end; k++) {
      if (oldLines[k] !== undefined) {
        hunk.lines.push(` ${oldLines[k]!}`);
        hunk.oldCount++;
        hunk.newCount++;
      }
    }
    return hunk;
  }

  for (const op of diffOps) {
    if (op.type === 'unchanged') {
      if (activeHunk !== null) {
        activeHunk.lines.push(` ${op.content}`);
        activeHunk.oldCount++;
        activeHunk.newCount++;
        contextCounter++;
        if (contextCounter >= 3) {
          hunks.push(activeHunk);
          activeHunk = null;
          contextCounter = 0;
        }
      }
      continue;
    }

    contextCounter = 0;
    if (activeHunk === null) {
      activeHunk = startHunk(op);
    }

    if (op.type === 'removed') {
      activeHunk.lines.push(`-${op.content}`);
      activeHunk.oldCount++;
    } else if (op.type === 'added') {
      activeHunk.lines.push(`+${op.content}`);
      activeHunk.newCount++;
    }
  }

  if (activeHunk !== null) {
    hunks.push(activeHunk);
  }

  for (const hunk of hunks) {
    output.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);
    output.push(...hunk.lines);
  }

  return output.join('\n');
}

export function diffMarkdown(oldContent: string, newContent: string): MarkdownDiffResult {
  if (oldContent === newContent) {
    return {
      hasChanges: false,
      addedLines: 0,
      removedLines: 0,
      diff: [],
      unifiedPatch: '',
    };
  }

  const oldLines = oldContent === '' ? [] : oldContent.split('\n');
  const newLines = newContent === '' ? [] : newContent.split('\n');

  const dp = computeLCSLength(oldLines, newLines);
  const diffOps = backtrackDiff(dp, oldLines, newLines);

  const diff: LineDiff[] = [];
  let addedCount = 0;
  let removedCount = 0;

  for (const op of diffOps) {
    if (op.type === 'added') {
      diff.push({ type: 'added', content: op.content, lineNumber: op.newLine ?? 0 });
      addedCount++;
    } else if (op.type === 'removed') {
      diff.push({ type: 'removed', content: op.content, lineNumber: op.oldLine ?? 0 });
      removedCount++;
    } else {
      diff.push({ type: 'unchanged', content: op.content, lineNumber: op.newLine ?? 0 });
    }
  }

  const unifiedPatch = buildUnifiedPatch(oldLines, diffOps);

  return {
    hasChanges: addedCount > 0 || removedCount > 0,
    addedLines: addedCount,
    removedLines: removedCount,
    diff,
    unifiedPatch,
  };
}