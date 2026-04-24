export interface SchemaFieldDiff {
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly changeType: 'added' | 'removed' | 'changed';
  readonly confidence: number;
}

export interface SchemaDiffResult {
  readonly hasChanges: boolean;
  readonly fieldChanges: ReadonlyArray<SchemaFieldDiff>;
  readonly addedFields: number;
  readonly removedFields: number;
  readonly changedFields: number;
}

function computeConfidence(oldValue: unknown, newValue: unknown): number {
  if (typeof oldValue === 'string' && typeof newValue === 'string') {
    const longer = oldValue.length >= newValue.length ? oldValue : newValue;
    if (longer.length === 0) return 1;
    const commonLen = longestCommonSubsequenceLength(oldValue, newValue);
    return commonLen / longer.length;
  }

  if (typeof oldValue === 'number' && typeof newValue === 'number') {
    const maxAbs = Math.max(Math.abs(oldValue), Math.abs(newValue));
    if (maxAbs === 0) return 1;
    return 1 - Math.abs(oldValue - newValue) / maxAbs;
  }

  if (typeof oldValue === 'object' && oldValue !== null && typeof newValue === 'object' && newValue !== null) {
    const oldKeys = Object.keys(oldValue as Record<string, unknown>);
    const newKeys = Object.keys(newValue as Record<string, unknown>);
    const allKeys = new Set([...oldKeys, ...newKeys]);
    let matching = 0;
    for (const key of allKeys) {
      const oldRec = oldValue as Record<string, unknown>;
      const newRec = newValue as Record<string, unknown>;
      if (key in oldRec && key in newRec && oldRec[key] === newRec[key]) {
        matching++;
      }
    }
    return allKeys.size === 0 ? 1 : matching / allKeys.size;
  }

  return 1;
}

function longestCommonSubsequenceLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1).fill(0) as number[];
  let curr = new Array(n + 1).fill(0) as number[];

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]! + 1;
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!);
      }
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[n]!;
}

export function diffSchema(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  confidenceThreshold: number = 0,
): SchemaDiffResult {
  const fieldChanges: SchemaFieldDiff[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const field of allKeys) {
    const inOld = field in oldData;
    const inNew = field in newData;

    if (inOld && !inNew) {
      const diff: SchemaFieldDiff = {
        field,
        oldValue: oldData[field],
        newValue: undefined,
        changeType: 'removed',
        confidence: 1,
      };
      fieldChanges.push(diff);
    } else if (!inOld && inNew) {
      const diff: SchemaFieldDiff = {
        field,
        oldValue: undefined,
        newValue: newData[field],
        changeType: 'added',
        confidence: 1,
      };
      fieldChanges.push(diff);
    } else if (inOld && inNew) {
      const oldVal = oldData[field];
      const newVal = newData[field];

      if (oldVal !== newVal) {
        const confidence = computeConfidence(oldVal, newVal);
        const diff: SchemaFieldDiff = {
          field,
          oldValue: oldVal,
          newValue: newVal,
          changeType: 'changed',
          confidence,
        };
        if (confidence >= confidenceThreshold) {
          fieldChanges.push(diff);
        }
      }
    }
  }

  const added = fieldChanges.filter((c) => c.changeType === 'added').length;
  const removed = fieldChanges.filter((c) => c.changeType === 'removed').length;
  const changed = fieldChanges.filter((c) => c.changeType === 'changed').length;

  return {
    hasChanges: fieldChanges.length > 0,
    fieldChanges,
    addedFields: added,
    removedFields: removed,
    changedFields: changed,
  };
}