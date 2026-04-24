#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { scrapeCommand } from './commands/scrape.js';
import { crawlCommand } from './commands/crawl.js';
import { mapCommand } from './commands/map.js';
import { searchCommand } from './commands/search.js';
import { extractCommand } from './commands/extract.js';
import { agentCommand } from './commands/agent.js';
import { replayCommand } from './commands/replay.js';
import { statusCommand } from './commands/status.js';
import { exportCommand } from './commands/export.js';
import { policyCommand } from './commands/policy.js';
import { watchCommand } from './commands/watch.js';
import { failuresCommand } from './commands/failures.js';
import { healthCommand } from './commands/health.js';
import { upCommand } from './commands/up.js';
import { downCommand } from './commands/down.js';

const program = new Command();

program
  .name('crawlx')
  .description('CrawlX CLI for web operations')
  .version('1.0.0');

program.addCommand(scrapeCommand);
program.addCommand(crawlCommand);
program.addCommand(mapCommand);
program.addCommand(searchCommand);
program.addCommand(extractCommand);
program.addCommand(agentCommand);
program.addCommand(replayCommand);
program.addCommand(statusCommand);
program.addCommand(exportCommand);
program.addCommand(policyCommand);
program.addCommand(watchCommand);
program.addCommand(failuresCommand);
program.addCommand(healthCommand);
program.addCommand(upCommand);
program.addCommand(downCommand);

program.parse();