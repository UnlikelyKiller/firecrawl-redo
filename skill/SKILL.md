---
name: crawlx
description: Use CrawlX for web scraping, crawling, structured extraction, browser automation, and agentic web research. Trigger when an agent needs web content, structured data from a URL, or needs to monitor pages for changes.
---

# CrawlX — Agent Skill

CrawlX is a local-first crawl operations platform. Use the CLI to scrape, crawl, extract, and research web content.

## When to Use

- **Scrape a single page:** `crawlx scrape <url>`
- **Crawl a site:** `crawlx crawl <url> --limit N`
- **Extract structured data:** `crawlx extract <url> --schema schema.json`
- **Research a topic (no URL known):** `crawlx agent "Find pricing for Notion"`
- **Monitor a page for changes:** `crawlx watch <url> --interval 24h`
- **Replay a failed job:** `crawlx replay <job-id>`

## Safety Rules

- Always set domain policy before bulk crawling a new domain
- Respect robots.txt (enforced by default)
- Do not attempt to bypass login walls or CAPTCHAs
- Do not scrape blocked domains (social media, etc.)
- Check `crawlx health` before starting large jobs
