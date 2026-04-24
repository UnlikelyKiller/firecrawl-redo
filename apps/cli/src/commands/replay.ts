import { Command } from 'commander';
import chalk from 'chalk';
import { apiPost, pollJobStatus } from '../api.js';

export const replayCommand = new Command('replay')
  .description('Replay a previously failed job')
  .argument('<jobId>', 'Job ID to replay')
  .action(async (jobId) => {
    console.log(chalk.blue(`Replaying job ${jobId}...`));

    const result = await apiPost<{ success: boolean; jobId?: string; error?: string }>(
      `/v2/crawlx/replay/${jobId}`,
      {},
    );

    if (result.success && result.jobId) {
      console.log(chalk.green(`Replay enqueued. New Job ID: ${result.jobId}`));
      console.log(chalk.gray('Polling for completion...'));

      const status = await pollJobStatus(result.jobId);
      console.log(chalk.green(`Replay complete! State: ${status.state}`));
    } else {
      console.error(chalk.red(`Replay failed: ${result.error ?? 'unknown error'}`));
    }
  });