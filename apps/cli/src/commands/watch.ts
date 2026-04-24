import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { apiPost } from '../api.js';

export const watchCommand = new Command('watch')
  .description('Watch a URL for changes (returns 501 Not Implemented)')
  .argument('<url>', 'URL to watch')
  .option('-i, --interval <interval>', 'Check interval (e.g., 24h, 1h)', '24h')
  .option('-s, --schema <path>', 'Path to JSON schema for change detection')
  .option('-w, --webhook <url>', 'Webhook URL to notify on change')
  .action(async (url, options) => {
    const body: Record<string, unknown> = {
      url,
      interval: options.interval,
    };

    if (options.webhook) body.webhook = options.webhook;

    if (options.schema) {
      const schemaPath = resolve(options.schema);
      try {
        const raw = readFileSync(schemaPath, 'utf-8');
        body.schema = JSON.parse(raw);
      } catch (err: any) {
        console.error(chalk.red(`Failed to read schema file: ${err.message}`));
        process.exit(1);
      }
    }

    console.log(chalk.blue(`Setting up watch for ${url} (interval: ${options.interval})...`));

    const result = await apiPost<{ success: boolean; watchId?: string; error?: string }>(
      '/v2/crawlx/watch',
      body,
    );

    if (result.success && result.watchId) {
      console.log(chalk.green(`Watch created. Watch ID: ${result.watchId}`));
    } else {
      console.error(chalk.red(`Watch failed: ${result.error ?? 'unknown error'}`));
    }
  });