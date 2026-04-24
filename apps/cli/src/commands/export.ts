import { Command } from 'commander';
import chalk from 'chalk';
import { apiGet } from '../api.js';

export const exportCommand = new Command('export')
  .description('Export job artifacts in a specified format')
  .argument('<jobId>', 'Job ID to export')
  .option('-f, --format <format>', 'Output format (markdown, json, artifacts)', 'json')
  .action(async (jobId, options) => {
    const validFormats = ['markdown', 'json', 'artifacts'];
    if (!validFormats.includes(options.format)) {
      console.error(chalk.red(`Invalid format "${options.format}". Valid: ${validFormats.join(', ')}`));
      process.exit(1);
    }

    const status = await apiGet<{
      state: string;
      artifacts?: Record<string, unknown>;
      error?: string;
    }>(`/v2/crawlx/status/${jobId}`);

    if (status.state !== 'COMPLETED' && status.state !== 'completed') {
      console.error(chalk.red(`Job ${jobId} is not completed (state: ${status.state})`));
      process.exit(1);
    }

    const exportData = await apiGet<unknown>(
      `/v2/crawlx/export/${jobId}?format=${options.format}`,
    );

    if (options.format === 'json') {
      console.log(JSON.stringify(exportData, null, 2));
    } else {
      console.log(JSON.stringify(exportData, null, 2));
    }
  });