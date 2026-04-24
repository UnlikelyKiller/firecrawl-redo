import { Command } from 'commander';
import chalk from 'chalk';
import { apiGet, apiPost } from '../api.js';

const policyCommand = new Command('policy')
  .description('Manage domain crawl policies');

policyCommand
  .command('set <domain>')
  .description('Set crawl policy for a domain')
  .option('--delay <ms>', 'Delay between requests in milliseconds', '3000')
  .option('--concurrency <n>', 'Max concurrent requests', '2')
  .option('--block-paths <paths>', 'Comma-separated path patterns to block')
  .action(async (domain, options) => {
    const body: Record<string, unknown> = {
      delay: parseInt(options.delay, 10),
      concurrency: parseInt(options.concurrency, 10),
    };
    if (options.blockPaths) {
      body.blockPaths = options.blockPaths.split(',');
    }

    console.log(chalk.blue(`Setting policy for ${domain}...`));

    const result = await apiPost<{ success: boolean; error?: string }>(
      `/v2/crawlx/policy/${domain}`,
      body,
    );

    if (result.success) {
      console.log(chalk.green(`Policy set for ${domain}`));
      console.log(chalk.white(`  Delay: ${body.delay}ms`));
      console.log(chalk.white(`  Concurrency: ${body.concurrency}`));
      if (body.blockPaths) {
        console.log(chalk.white(`  Blocked paths: ${(body.blockPaths as string[]).join(', ')}`));
      }
    } else {
      console.error(chalk.red(`Failed to set policy: ${result.error ?? 'unknown error'}`));
    }
  });

policyCommand
  .command('get <domain>')
  .description('Get crawl policy for a domain')
  .action(async (domain) => {
    const result = await apiGet<{
      success: boolean;
      delay?: number;
      concurrency?: number;
      blockPaths?: string[];
      error?: string;
    }>(`/v2/crawlx/policy/${domain}`);

    if (result.success) {
      console.log(chalk.white(`Domain: ${domain}`));
      console.log(chalk.white(`  Delay: ${result.delay ?? 'default'}ms`));
      console.log(chalk.white(`  Concurrency: ${result.concurrency ?? 'default'}`));
      if (result.blockPaths && result.blockPaths.length > 0) {
        console.log(chalk.white(`  Blocked paths: ${result.blockPaths.join(', ')}`));
      }
    } else {
      console.error(chalk.red(`No policy found for ${domain}: ${result.error ?? 'unknown'}`));
    }
  });

policyCommand
  .command('list')
  .description('List all domain crawl policies')
  .action(async () => {
    const result = await apiGet<{
      success: boolean;
      policies?: Array<{ domain: string; delay: number; concurrency: number; blockPaths?: string[] }>;
      error?: string;
    }>('/v2/crawlx/policy');

    if (result.success && result.policies) {
      if (result.policies.length === 0) {
        console.log(chalk.gray('No domain policies configured.'));
        return;
      }
      console.log(chalk.white(`${result.policies.length} policy(ies):\n`));
      for (const p of result.policies) {
        console.log(chalk.white(`  ${p.domain}: delay=${p.delay}ms, concurrency=${p.concurrency}`));
        if (p.blockPaths && p.blockPaths.length > 0) {
          console.log(chalk.gray(`    blocked: ${p.blockPaths.join(', ')}`));
        }
      }
    } else {
      console.error(chalk.red(`Failed to list policies: ${result.error ?? 'unknown error'}`));
    }
  });

export { policyCommand };