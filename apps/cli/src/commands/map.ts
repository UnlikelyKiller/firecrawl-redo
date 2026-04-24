import { Command } from 'commander';
import chalk from 'chalk';
import { apiPost } from '../api.js';

export const mapCommand = new Command('map')
  .description('Map all URLs on a website')
  .argument('<url>', 'URL to map')
  .option('--ignoreCache', 'Ignore cached results')
  .action(async (url, options) => {
    const body: Record<string, unknown> = { url };
    if (options.ignoreCache) body.ignoreCache = true;

    console.log(chalk.blue(`Mapping ${url}...`));

    const result = await apiPost<{ success: boolean; urls?: string[]; error?: string }>(
      '/v2/crawlx/map',
      body,
    );

    if (result.success && result.urls) {
      console.log(chalk.green(`Found ${result.urls.length} URLs:`));
      for (const u of result.urls) {
        console.log(chalk.white(`  ${u}`));
      }
    } else {
      console.error(chalk.red(`Failed to map: ${result.error ?? 'unknown error'}`));
    }
  });