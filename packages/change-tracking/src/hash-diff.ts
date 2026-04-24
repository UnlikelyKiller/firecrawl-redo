export interface HashDiffResult {
  readonly oldHash: string;
  readonly newHash: string;
  readonly changed: boolean;
}

export function compareContentHashes(oldHash: string, newHash: string): HashDiffResult {
  return {
    oldHash,
    newHash,
    changed: oldHash !== newHash,
  };
}