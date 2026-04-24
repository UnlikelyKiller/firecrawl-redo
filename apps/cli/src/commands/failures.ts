import { Command } from 'commander';
import chalk from 'chalk';
import { apiGet } from '../api.js';

export const failuresCommand = new Command('failures')
  .description('List recent crawl failures')
  .option('--domain <domain>', 'Filter by domain')
  .option('--class <failureClass>', 'Filter by failure class')
  .action(async (options) => {
    const params = new URLSearchParams();
    if (options.domain) params.set('domain', options.domain);
    if (options.class) params.set('class', options.class);

    const qs = params.toString() ? `?${params.toString()}` : '';

    const result = await apiGet<{
      success: boolean;
      failures?: Array<{ jobId: string; url: string; error: string; failureClass: string; timestamp: string }>;
      error?: string;
    }>(`/v2/crawlx/failures${qs}`);

    if (result.success && result.failures) {
      if (result.failures.length === 0) {
        console.log(chalk.gray('No failures found.'));
        return;
      }
      console.log(chalk.white(`${result.failures.length} failure(s):\n`));
      for (const f of result.failures) {
        console.log(chalk.red(`  [${f.failureClass}] ${f.url}`));
        console.log(chalk.gray(`    Job: ${f.jobId}`));
        console.log(chalk.gray(`    Error: ${f.error}`));
        console.log(chalk.gray(`    Time: ${f.timestamp}`));
        console.log();
      }
    } else {
      console.error(chalk.red(`Failed to fetch failures: ${result.error ?? 'unknown error'}`));
    }
  });