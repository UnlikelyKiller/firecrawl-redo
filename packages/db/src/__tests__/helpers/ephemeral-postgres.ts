import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';

const execFileAsync = promisify(execFile);
const POSTGRES_IMAGE = 'postgres:16-alpine';
const POSTGRES_PASSWORD = 'postgres';
const POSTGRES_USER = 'postgres';
const POSTGRES_DB = 'postgres';

export type EphemeralPostgres = {
  connectionString: string;
  sql: postgres.Sql;
  stop: () => Promise<void>;
};

async function reservePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to reserve an ephemeral Postgres port.')));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function runDocker(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return await execFileAsync('docker', args, {
    windowsHide: true,
  });
}

export async function startEphemeralPostgres(): Promise<EphemeralPostgres> {
  const port = await reservePort();
  const containerName = `crawlx-db-smoke-${randomUUID()}`;

  await runDocker([
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--publish',
    `127.0.0.1:${port}:5432`,
    '--env',
    `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
    '--env',
    `POSTGRES_USER=${POSTGRES_USER}`,
    '--env',
    `POSTGRES_DB=${POSTGRES_DB}`,
    POSTGRES_IMAGE,
  ]);

  const connectionString = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${port}/${POSTGRES_DB}`;
  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 1,
    connect_timeout: 2,
  });

  try {
    const deadline = Date.now() + 30_000;

    while (true) {
      try {
        await sql`select 1`;
        break;
      } catch (error) {
        if (Date.now() >= deadline) {
          const logs = await runDocker(['logs', containerName]).catch(() => ({ stdout: '', stderr: '' }));
          const cause = error instanceof Error ? error.message : String(error);
          throw new Error(`Ephemeral Postgres did not become ready: ${cause}\n${logs.stdout}${logs.stderr}`.trim());
        }

        await delay(500);
      }
    }

    await sql`create extension if not exists pgcrypto`;

    return {
      connectionString,
      sql,
      stop: async () => {
        await sql.end({ timeout: 5 });
        await runDocker(['rm', '--force', containerName]).catch(() => undefined);
      },
    };
  } catch (error) {
    await sql.end({ timeout: 5 }).catch(() => undefined);
    await runDocker(['rm', '--force', containerName]).catch(() => undefined);
    throw error;
  }
}
