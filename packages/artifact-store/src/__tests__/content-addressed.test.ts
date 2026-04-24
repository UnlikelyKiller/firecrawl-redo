import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { ContentAddressedStore, ArtifactStoreError } from '../content-addressed';

describe('ContentAddressedStore', () => {
  let tmpDir: string;
  let store: ContentAddressedStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crawlx-artifact-test-'));
    store = new ContentAddressedStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('store - same content produces same hash', () => {
    it('returns the same hash for identical content', async () => {
      const content = 'Hello, world!';
      const result1 = await store.store(content, 'txt');
      const result2 = await store.store(content, 'txt');

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      if (result1.isOk() && result2.isOk()) {
        expect(result1.value).toBe(result2.value);
      }
    });

    it('returns a SHA-256 hash (64 hex chars)', async () => {
      const result = await store.store('test content', 'txt');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('returns the expected hash for known content', async () => {
      const content = 'test content';
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');
      const result = await store.store(content, 'txt');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(expectedHash);
      }
    });
  });

  describe('store - different content produces different hash', () => {
    it('returns different hashes for different content', async () => {
      const result1 = await store.store('content A', 'txt');
      const result2 = await store.store('content B', 'txt');

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);
      if (result1.isOk() && result2.isOk()) {
        expect(result1.value).not.toBe(result2.value);
      }
    });
  });

  describe('store - file stored at correct path', () => {
    it('stores file at sha256/{first2}/{next2}/{hash}.ext', async () => {
      const content = 'path test content';
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const first2 = hash.substring(0, 2);
      const next2 = hash.substring(2, 4);
      const expectedFilePath = path.join(tmpDir, 'sha256', first2, next2, `${hash}.txt`);

      const result = await store.store(content, 'txt');
      expect(result.isOk()).toBe(true);

      // Verify the file exists on disk
      const fileExists = await fs.access(expectedFilePath).then(() => true, () => false);
      expect(fileExists).toBe(true);

      // Verify file content matches
      const fileContent = await fs.readFile(expectedFilePath, 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('strips leading dot from extension', async () => {
      const content = 'dot extension test';
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const first2 = hash.substring(0, 2);
      const next2 = hash.substring(2, 4);
      const expectedFilePath = path.join(tmpDir, 'sha256', first2, next2, `${hash}.html`);

      const result = await store.store(content, '.html');
      expect(result.isOk()).toBe(true);

      const fileExists = await fs.access(expectedFilePath).then(() => true, () => false);
      expect(fileExists).toBe(true);
    });
  });

  describe('retrieve - returns stored content', () => {
    it('retrieves content that was previously stored', async () => {
      const content = 'retrieve me';
      const storeResult = await store.store(content, 'txt');

      expect(storeResult.isOk()).toBe(true);
      if (storeResult.isOk()) {
        const retrieveResult = await store.retrieve(storeResult.value, 'txt');
        expect(retrieveResult.isOk()).toBe(true);
        if (retrieveResult.isOk()) {
          expect(retrieveResult.value.toString('utf-8')).toBe(content);
        }
      }
    });

    it('returns error for non-existent hash', async () => {
      const result = await store.retrieve('0000000000000000000000000000000000000000000000000000000000000000', 'txt');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ArtifactStoreError);
        expect(result.error.message).toContain('Failed to retrieve');
      }
    });
  });

  describe('exists - returns true for stored content', () => {
    it('returns true after content is stored', async () => {
      const content = 'existence check';
      const storeResult = await store.store(content, 'txt');

      expect(storeResult.isOk()).toBe(true);
      if (storeResult.isOk()) {
        const existsResult = await store.exists(storeResult.value, 'txt');
        expect(existsResult.isOk()).toBe(true);
        if (existsResult.isOk()) {
          expect(existsResult.value).toBe(true);
        }
      }
    });
  });

  describe('exists - returns false for non-existent content', () => {
    it('returns false for a hash that was never stored', async () => {
      const existsResult = await store.exists('0000000000000000000000000000000000000000000000000000000000000000', 'txt');
      expect(existsResult.isOk()).toBe(true);
      if (existsResult.isOk()) {
        expect(existsResult.value).toBe(false);
      }
    });
  });

  describe('round-trip: store and retrieve', () => {
    it('stores Buffer content and retrieves it back identically', async () => {
      const content = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header bytes
      const storeResult = await store.store(content, 'png');

      expect(storeResult.isOk()).toBe(true);
      if (storeResult.isOk()) {
        const retrieveResult = await store.retrieve(storeResult.value, 'png');
        expect(retrieveResult.isOk()).toBe(true);
        if (retrieveResult.isOk()) {
          expect(retrieveResult.value).toEqual(content);
        }
      }
    });

    it('stores string content and retrieves it back identically', async () => {
      const content = '<html><body>Hello</body></html>';
      const storeResult = await store.store(content, 'html');

      expect(storeResult.isOk()).toBe(true);
      if (storeResult.isOk()) {
        const retrieveResult = await store.retrieve(storeResult.value, 'html');
        expect(retrieveResult.isOk()).toBe(true);
        if (retrieveResult.isOk()) {
          expect(retrieveResult.value.toString('utf-8')).toBe(content);
        }
      }
    });
  });
});