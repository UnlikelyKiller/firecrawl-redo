import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { SessionVault } from '../session-vault.js';

describe('SessionVault', () => {
  let vaultDir: string;
  let vault: SessionVault;
  const masterKey = crypto.randomBytes(32).toString('hex');

  beforeEach(async () => {
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-test-'));
    vault = new SessionVault(vaultDir, masterKey);
  });

  afterEach(async () => {
    await fs.rm(vaultDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('store and retrieve', () => {
    it('should encrypt and decrypt profile data round-trip', async () => {
      const profileData = Buffer.from('cookie-session-data-xyz');
      const expiresAt = new Date(Date.now() + 3600_000);

      const storeResult = await vault.store('example.com', profileData, expiresAt);
      expect(storeResult.isOk()).toBe(true);

      const profileId = storeResult._unsafeUnwrap();
      expect(typeof profileId).toBe('string');

      const retrieveResult = await vault.retrieve(profileId);
      expect(retrieveResult.isOk()).toBe(true);
      expect(retrieveResult._unsafeUnwrap().toString()).toBe(profileData.toString());
    });

    it('should fail to retrieve a non-existent profile', async () => {
      const result = await vault.retrieve('nonexistent-id');
      expect(result.isErr()).toBe(true);
    });

    it('should fail with wrong master key', async () => {
      const profileData = Buffer.from('secret-data');
      const expiresAt = new Date(Date.now() + 3600_000);

      const storeResult = await vault.store('example.com', profileData, expiresAt);
      const profileId = storeResult._unsafeUnwrap();

      const wrongKeyVault = new SessionVault(vaultDir, crypto.randomBytes(32).toString('hex'));
      const retrieveResult = await wrongKeyVault.retrieve(profileId);
      expect(retrieveResult.isErr()).toBe(true);
    });
  });

  describe('isValid', () => {
    it('should return true for a valid profile', async () => {
      const profileData = Buffer.from('valid-session');
      const expiresAt = new Date(Date.now() + 3600_000);

      const profileId = (await vault.store('example.com', profileData, expiresAt))._unsafeUnwrap();
      const validResult = await vault.isValid(profileId, 'example.com');
      expect(validResult.isOk()).toBe(true);
      expect(validResult._unsafeUnwrap()).toBe(true);
    });

    it('should reject an expired profile', async () => {
      const profileData = Buffer.from('expired-session');
      const expiresAt = new Date(Date.now() - 1000);

      const profileId = (await vault.store('example.com', profileData, expiresAt))._unsafeUnwrap();
      const validResult = await vault.isValid(profileId, 'example.com');
      expect(validResult.isOk()).toBe(true);
      expect(validResult._unsafeUnwrap()).toBe(false);
    });

    it('should reject a profile with the wrong domain', async () => {
      const profileData = Buffer.from('wrong-domain-session');
      const expiresAt = new Date(Date.now() + 3600_000);

      const profileId = (await vault.store('example.com', profileData, expiresAt))._unsafeUnwrap();
      const validResult = await vault.isValid(profileId, 'other.com');
      expect(validResult.isOk()).toBe(true);
      expect(validResult._unsafeUnwrap()).toBe(false);
    });

    it('should return error for a non-existent profile', async () => {
      const validResult = await vault.isValid('nonexistent-id', 'example.com');
      expect(validResult.isErr()).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove expired profiles', async () => {
      const data1 = Buffer.from('expired-1');
      const data2 = Buffer.from('valid-1');

      await vault.store('a.com', data1, new Date(Date.now() - 5000));
      await vault.store('b.com', data2, new Date(Date.now() + 3600_000));

      const cleanupResult = await vault.cleanup();
      expect(cleanupResult.isOk()).toBe(true);
      expect(cleanupResult._unsafeUnwrap()).toBe(1);
    });

    it('should return 0 when no profiles are expired', async () => {
      await vault.store('a.com', Buffer.from('data'), new Date(Date.now() + 3600_000));

      const cleanupResult = await vault.cleanup();
      expect(cleanupResult.isOk()).toBe(true);
      expect(cleanupResult._unsafeUnwrap()).toBe(0);
    });

    it('should handle empty vault directory', async () => {
      const cleanupResult = await vault.cleanup();
      expect(cleanupResult.isOk()).toBe(true);
      expect(cleanupResult._unsafeUnwrap()).toBe(0);
    });
  });
});