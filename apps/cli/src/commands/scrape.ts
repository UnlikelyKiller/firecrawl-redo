import { Command } from 'commander';
import axios from 'axios';
import chalk from 'chalk';

export const scrapeCommand = new Command('scrape')
  .description('Scrape a single URL')
  .argument('<url>', 'URL to scrape')
  .option('-f, --formats <formats>', 'Comma-separated formats (markdown, html, screenshot, links)', 'markdown')
  .option('-w, --wait <ms>', 'Wait time in milliseconds', '0')
  .action(async (url, options) => {
    try {
      const baseUrl = process.env.CRAWLX_API_URL || 'http://localhost:3002';
      const formats = options.formats.split(',');
      
      console.log(chalk.blue(`Enqueuing scrape for ${url}...`));
      
      const response = await axios.post(`${baseUrl}/v2/crawlx/scrape`, {
        url,
        formats,
        waitFor: parseInt(options.wait, 10),
      });

      if (response.data.success) {
        console.log(chalk.green(`Job successfully enqueued!`));
        console.log(chalk.white(`Job ID: ${response.data.jobId}`));
        console.log(chalk.gray(`Check status with: crawlx status ${response.data.jobId}`));
      } else {
        console.error(chalk.red(`Failed to enqueue job: ${response.data.error}`));
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (error.response) {
        console.error(chalk.red(JSON.stringify(error.response.data, null, 2)));
      }
    }
  });
