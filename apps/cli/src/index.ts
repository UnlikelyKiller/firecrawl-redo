#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { scrapeCommand } from './commands/scrape.js';

const program = new Command();

program
  .name('crawlx')
  .description('CrawlX CLI for web operations')
  .version('1.0.0');

program.addCommand(scrapeCommand);

program.parse();
