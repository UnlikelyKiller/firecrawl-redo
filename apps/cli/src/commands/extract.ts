import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { apiPost } from '../api.js';

export const extractCommand = new Command('extract')
  .description('Extract structured data from a URL using a JSON schema')
  .argument('<url>', 'URL to extract data from')
  .requiredOption('-s, --schema <path>', 'Path to JSON schema file')
  .option('-m, --model <model>', 'Extraction model', 'kimi-k2.6:cloud')
  .action(async (url, options) => {
    const schemaPath = resolve(options.schema);
    let schema: unknown;
    try {
      const raw = readFileSync(schemaPath, 'utf-8');
      schema = JSON.parse(raw);
    } catch (err: any) {
      console.error(chalk.red(`Failed to read schema file: ${err.message}`));
      process.exit(1);
    }

    console.log(chalk.blue(`Extracting data from ${url}...`));

    const result = await apiPost<{ success: boolean; data?: unknown; error?: string }>(
      '/v2/crawlx/extract',
      { url, schema, model: options.model },
    );

    if (result.success && result.data !== undefined) {
      console.log(chalk.green('Extraction complete:'));
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error(chalk.red(`Extraction failed: ${result.error ?? 'unknown error'}`));
    }
  });