import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { apiPost } from '../api.js';

export const agentCommand = new Command('agent')
  .description('Run an agentic web research task')
  .argument('<prompt>', 'Research prompt for the agent')
  .option('-s, --schema <path>', 'Path to JSON schema for structured output')
  .option('--max-pages <n>', 'Maximum pages the agent may visit', '10')
  .action(async (prompt, options) => {
    const body: Record<string, unknown> = {
      prompt,
      maxPages: parseInt(options.maxPages, 10),
    };

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

    console.log(chalk.blue(`Starting agent task: "${prompt}"...`));

    const result = await apiPost<{ success: boolean; data?: unknown; error?: string }>(
      '/v2/crawlx/agent',
      body,
    );

    if (result.success && result.data !== undefined) {
      console.log(chalk.green('Agent task complete:'));
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error(chalk.red(`Agent task failed: ${result.error ?? 'unknown error'}`));
    }
  });