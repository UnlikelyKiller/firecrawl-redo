import { execSync } from 'node:child_process';
import { Command } from 'commander';
import chalk from 'chalk';

export const upCommand = new Command('up')
  .description('Start CrawlX infrastructure services via Docker Compose')
  .action(() => {
    console.log(chalk.blue('Starting CrawlX infrastructure...'));
    try {
      execSync('docker compose up -d', { stdio: 'inherit' });
      console.log(chalk.green('Infrastructure started.'));
    } catch (err: any) {
      console.error(chalk.red(`Failed to start infrastructure: ${err.message}`));
      process.exit(1);
    }
  });