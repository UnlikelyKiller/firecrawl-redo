import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Result, ResultAsync, ok, err } from 'neverthrow';

export interface BrowserProfile {
  readonly id: string;
  readonly domain: string;
  readonly encryptedData: string;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export class SessionVaultError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SessionVaultError';
    this.cause = cause;
  }
}

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class SessionVault {
  private readonly masterKeyBuffer: Buffer;

  constructor(
    private readonly vaultDir: string,
    masterKey: string,
  ) {
    this.masterKeyBuffer = Buffer.from(masterKey, 'hex');
    if (this.masterKeyBuffer.length !== 32) {
      throw new SessionVaultError('Master key must be 32 bytes (64 hex characters) for AES-256-GCM.');
    }
  }

  async store(
    domain: string,
    profileData: Buffer,
    expiresAt: Date,
  ): Promise<Result<string, SessionVaultError>> {
    return ResultAsync.fromPromise(
      (async () => {
        await fs.mkdir(this.vaultDir, { recursive: true });

        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.masterKeyBuffer, iv);
        const encrypted = Buffer.concat([cipher.update(profileData), cipher.final()]);
        const authTag = cipher.getAuthTag();

        const id = crypto.randomUUID();
        const payload = Buffer.concat([iv, authTag, encrypted]).toString('base64');

        const profile: BrowserProfile = {
          id,
          domain,
          encryptedData: payload,
          expiresAt: expiresAt.toISOString(),
          createdAt: new Date().toISOString(),
        };

        const filePath = path.join(this.vaultDir, `${id}.json`);
        await fs.writeFile(filePath, JSON.stringify(profile));

        return id;
      })(),
      (e) => new SessionVaultError('Failed to store browser profile', e),
    );
  }

  async retrieve(profileId: string): Promise<Result<Buffer, SessionVaultError>> {
    return ResultAsync.fromPromise(
      (async () => {
        const filePath = path.join(this.vaultDir, `${profileId}.json`);
        const raw = await fs.readFile(filePath, 'utf-8');
        const profile: BrowserProfile = JSON.parse(raw);

        const payload = Buffer.from(profile.encryptedData, 'base64');
        const iv = payload.subarray(0, IV_LENGTH);
        const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKeyBuffer, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
      })(),
      (e) => new SessionVaultError('Failed to retrieve browser profile', e),
    );
  }

  async isValid(profileId: string, domain: string): Promise<Result<boolean, SessionVaultError>> {
    return ResultAsync.fromPromise(
      (async (): Promise<boolean> => {
        const filePath = path.join(this.vaultDir, `${profileId}.json`);
        const raw = await fs.readFile(filePath, 'utf-8');
        const profile: BrowserProfile = JSON.parse(raw);

        if (profile.domain !== domain) {
          return false;
        }

        if (new Date(profile.expiresAt) <= new Date()) {
          return false;
        }

        return true;
      })(),
      (e) => new SessionVaultError('Failed to validate browser profile', e),
    );
  }

  async cleanup(): Promise<Result<number, SessionVaultError>> {
    return ResultAsync.fromPromise(
      (async (): Promise<number> => {
        await fs.mkdir(this.vaultDir, { recursive: true });
        const files = await fs.readdir(this.vaultDir);
        const now = new Date();
        let removed = 0;

        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const filePath = path.join(this.vaultDir, file);
          try {
            const raw = await fs.readFile(filePath, 'utf-8');
            const profile: BrowserProfile = JSON.parse(raw);
            if (new Date(profile.expiresAt) <= now) {
              await fs.unlink(filePath);
              removed += 1;
            }
          } catch {
            continue;
          }
        }

        return removed;
      })(),
      (e) => new SessionVaultError('Failed to cleanup expired profiles', e),
    );
  }
}