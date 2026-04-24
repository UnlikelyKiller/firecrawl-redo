import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ok, err, Result, ResultAsync } from 'neverthrow';

export class ArtifactStoreError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ArtifactStoreError';
  }
}

export class ContentAddressedStore {
  constructor(private readonly baseDir: string) {}

  /**
   * Stores content based on its SHA-256 hash.
   * Path: baseDir/sha256/{first2}/{next2}/{hash}.{ext}
   */
  async store(content: string | Buffer, extension: string): Promise<Result<string, ArtifactStoreError>> {
    try {
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const first2 = hash.substring(0, 2);
      const next2 = hash.substring(2, 4);
      const dirPath = path.join(this.baseDir, 'sha256', first2, next2);
      const filePath = path.join(dirPath, `${hash}.${extension.replace(/^\./, '')}`);

      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(filePath, content);

      return ok(hash);
    } catch (e) {
      return err(new ArtifactStoreError('Failed to store artifact', e));
    }
  }

  /**
   * Retrieves content by its hash and extension.
   */
  async retrieve(hash: string, extension: string): Promise<Result<Buffer, ArtifactStoreError>> {
    try {
      const first2 = hash.substring(0, 2);
      const next2 = hash.substring(2, 4);
      const filePath = path.join(this.baseDir, 'sha256', first2, next2, `${hash}.${extension.replace(/^\./, '')}`);

      const content = await fs.readFile(filePath);
      return ok(content);
    } catch (e) {
      return err(new ArtifactStoreError(`Failed to retrieve artifact with hash ${hash}`, e));
    }
  }

  /**
   * Checks if an artifact exists.
   */
  async exists(hash: string, extension: string): Promise<Result<boolean, ArtifactStoreError>> {
    try {
      const first2 = hash.substring(0, 2);
      const next2 = hash.substring(2, 4);
      const filePath = path.join(this.baseDir, 'sha256', first2, next2, `${hash}.${extension.replace(/^\./, '')}`);

      await fs.access(filePath);
      return ok(true);
    } catch (e) {
      if ((e as any).code === 'ENOENT') {
        return ok(false);
      }
      return err(new ArtifactStoreError(`Failed to check existence of artifact with hash ${hash}`, e));
    }
  }
}
