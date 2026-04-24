import { Command } from 'commander';
import chalk from 'chalk';
import { apiPost } from '../api.js';

export const scrapeCommand = new Command('scrape')
  .description('Scrape a single URL')
  .argument('<url>', 'URL to scrape')
  .option('-f, --formats <formats>', 'Comma-separated formats (markdown, html, screenshot, links)', 'markdown')
  .option('-w, --wait <ms>', 'Wait time in milliseconds', '0')
  .action(async (url, options) => {
    const formats = options.formats.split(',');

    console.log(chalk.blue(`Enqueuing scrape for ${url}...`));

    const response = await apiPost<{ success: boolean; jobId?: string; error?: string }>(
      '/v2/crawlx/scrape',
      {
        url,
        formats,
        waitFor: parseInt(options.wait, 10),
      },
    );

    if (response.success && response.jobId) {
      console.log(chalk.green('Job successfully enqueued!'));
      console.log(chalk.white(`Job ID: ${response.jobId}`));
      console.log(chalk.gray(`Check status with: crawlx status ${response.jobId}`));
    } else {
      console.error(chalk.red(`Failed to enqueue job: ${response.error ?? 'unknown error'}`));
    }
  });