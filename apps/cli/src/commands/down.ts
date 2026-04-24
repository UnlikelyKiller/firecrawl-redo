import { execSync } from 'node:child_process';
import { Command } from 'commander';
import chalk from 'chalk';

export const downCommand = new Command('down')
  .description('Stop CrawlX infrastructure services via Docker Compose')
  .action(() => {
    console.log(chalk.blue('Stopping CrawlX infrastructure...'));
    try {
      execSync('docker compose down', { stdio: 'inherit' });
      console.log(chalk.green('Infrastructure stopped.'));
    } catch (err: any) {
      console.error(chalk.red(`Failed to stop infrastructure: ${err.message}`));
      process.exit(1);
    }
  });