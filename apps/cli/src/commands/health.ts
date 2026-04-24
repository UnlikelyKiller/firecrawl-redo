import { Command } from 'commander';
import chalk from 'chalk';
import { apiGet } from '../api.js';

export const healthCommand = new Command('health')
  .description('Check CrawlX service health')
  .action(async () => {
    const result = await apiGet<{
      status: string;
      version?: string;
      uptime?: number;
      services?: Record<string, { status: string; latency?: number }>;
    }>('/v2/crawlx/health');

    const isOk = result.status === 'ok' || result.status === 'healthy';
    console.log(isOk ? chalk.green(`Status: ${result.status}`) : chalk.red(`Status: ${result.status}`));

    if (result.version) {
      console.log(chalk.white(`Version: ${result.version}`));
    }

    if (result.uptime != null) {
      console.log(chalk.white(`Uptime: ${Math.round(result.uptime / 1000)}s`));
    }

    if (result.services) {
      console.log(chalk.white('Services:'));
      for (const [name, svc] of Object.entries(result.services)) {
        const svcColor = svc.status === 'ok' || svc.status === 'healthy' ? chalk.green : chalk.red;
        const latency = svc.latency != null ? ` (${svc.latency}ms)` : '';
        console.log(svcColor(`  ${name}: ${svc.status}${latency}`));
      }
    }
  });