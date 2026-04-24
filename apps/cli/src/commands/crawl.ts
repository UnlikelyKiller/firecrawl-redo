import { Command } from 'commander';
import chalk from 'chalk';
import { apiPost, pollJobStatus } from '../api.js';

export const crawlCommand = new Command('crawl')
  .description('Crawl a website starting from a URL')
  .argument('<url>', 'Starting URL to crawl')
  .option('-l, --limit <n>', 'Maximum number of pages to crawl', '100')
  .option('--sitemapOnly', 'Only crawl URLs found in the sitemap')
  .option('--ignoreCache', 'Ignore cached results and force fresh crawl')
  .action(async (url, options) => {
    const body: Record<string, unknown> = {
      url,
      limit: parseInt(options.limit, 10),
    };
    if (options.sitemapOnly) body.sitemapOnly = true;
    if (options.ignoreCache) body.ignoreCache = true;

    console.log(chalk.blue(`Starting crawl for ${url}...`));

    const result = await apiPost<{ success: boolean; jobId?: string; error?: string }>(
      '/v2/crawlx/crawl',
      body,
    );

    if (result.success && result.jobId) {
      console.log(chalk.green(`Crawl enqueued. Job ID: ${result.jobId}`));
      console.log(chalk.gray('Polling for completion...'));

      const status = await pollJobStatus(result.jobId);
      console.log(chalk.green(`Crawl complete! ${status.total ?? 0} pages processed.`));
    } else {
      console.error(chalk.red(`Failed to start crawl: ${result.error ?? 'unknown error'}`));
    }
  });