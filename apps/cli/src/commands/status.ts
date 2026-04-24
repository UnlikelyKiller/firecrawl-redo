import { Command } from 'commander';
import chalk from 'chalk';
import { apiGet } from '../api.js';

export const statusCommand = new Command('status')
  .description('Check the status of a job')
  .argument('<jobId>', 'Job ID to check')
  .action(async (jobId) => {
    const status = await apiGet<{
      jobId: string;
      state: string;
      progress?: number;
      total?: number;
      error?: string;
      artifacts?: Record<string, unknown>;
    }>(`/v2/crawlx/status/${jobId}`);

    const stateColor = status.state === 'COMPLETED' || status.state === 'completed'
      ? chalk.green
      : status.state === 'FAILED' || status.state === 'failed'
        ? chalk.red
        : chalk.yellow;

    console.log(chalk.white(`Job ID:    ${status.jobId}`));
    console.log(stateColor(`State:     ${status.state}`));

    if (status.progress != null && status.total != null) {
      console.log(chalk.white(`Progress:  ${status.progress}/${status.total}`));
    }

    if (status.error) {
      console.error(chalk.red(`Error:     ${status.error}`));
    }

    if (status.artifacts && Object.keys(status.artifacts).length > 0) {
      console.log(chalk.white('Artifacts:'));
      for (const [key, value] of Object.entries(status.artifacts)) {
        console.log(chalk.gray(`  ${key}: ${JSON.stringify(value)}`));
      }
    }
  });