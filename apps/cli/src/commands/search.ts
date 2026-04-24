import { Command } from 'commander';
import chalk from 'chalk';
import { apiPost } from '../api.js';

export const searchCommand = new Command('search')
  .description('Search the web for a query')
  .argument('<query>', 'Search query')
  .option('-l, --limit <n>', 'Maximum number of results', '10')
  .action(async (query, options) => {
    console.log(chalk.blue(`Searching: "${query}"...`));

    const result = await apiPost<{ success: boolean; results?: Array<{ url: string; title?: string; snippet?: string }>; error?: string }>(
      '/v2/crawlx/search',
      { query, limit: parseInt(options.limit, 10) },
    );

    if (result.success && result.results) {
      console.log(chalk.green(`Found ${result.results.length} results:\n`));
      for (const r of result.results) {
        console.log(chalk.white(`  ${r.title ?? 'Untitled'}`));
        console.log(chalk.gray(`    ${r.url}`));
        if (r.snippet) console.log(chalk.gray(`    ${r.snippet}`));
        console.log();
      }
    } else {
      console.error(chalk.red(`Search failed: ${result.error ?? 'unknown error'}`));
    }
  });