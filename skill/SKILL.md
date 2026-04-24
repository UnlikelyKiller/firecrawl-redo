---
name: crawlx
description: Use CrawlX for web scraping, crawling, structured extraction, browser automation, and agentic web research. Trigger when an agent needs web content, structured data from a URL, or needs to monitor pages for changes.
---

# CrawlX — Agent Skill

CrawlX is a local-first crawl operations platform. Use the CLI to scrape, crawl, extract, and research web content.

## When to Use

- **Scrape a single page:** `crawlx scrape <url>`
- **Crawl a site:** `crawlx crawl <url> --limit N`
- **Map all URLs on a site:** `crawlx map <url>`
- **Search the web:** `crawlx search "<query>"`
- **Extract structured data:** `crawlx extract <url> --schema schema.json`
- **Research a topic (no URL known):** `crawlx agent "Find pricing for Notion"`
- **Monitor a page for changes:** `crawlx watch <url> --interval 24h`
- **Replay a failed job:** `crawlx replay <job-id>`
- **Check job status:** `crawlx status <job-id>`
- **Export job artifacts:** `crawlx export <job-id> --format markdown|json|artifacts`
- **Manage domain policies:** `crawlx policy set|get|list`
- **View failures:** `crawlx failures [--domain <domain>] [--class <class>]`
- **Check service health:** `crawlx health`
- **Start/stop infrastructure:** `crawlx up` / `crawlx down`

## When NOT to Use

- Internal/authenticated company pages (use appropriate internal tools)
- Social media scraping (blocked by default policy)
- Bulk scraping without domain policy (set policy first)

## Common Patterns

### Get markdown from a URL
```bash
crawlx scrape https://example.com --format markdown
```

### Crawl a site with a limit
```bash
crawlx crawl https://example.com --limit 50
```

### Map all URLs on a site
```bash
crawlx map https://example.com
```

### Search the web
```bash
crawlx search "Notion pricing plans" --limit 5
```

### Extract structured data
```bash
cat > pricing.json << 'EOF'
{ "plans": [{ "name": "string", "price": "string", "features": ["string"] }] }
EOF
crawlx extract https://example.com/pricing --schema pricing.json
```

### Research without a URL
```bash
crawlx agent "Find the current pricing plans for Notion" --max-pages 5
```

### Set a domain policy before crawling
```bash
crawlx policy set example.com --delay 3000 --concurrency 2
```

### Watch a page for changes
```bash
crawlx watch https://example.com/pricing --interval 24h --webhook https://hooks.example.com/crawlx
```

### Check job status
```bash
crawlx status <job-id>
```

### Export artifacts
```bash
crawlx export <job-id> --format artifacts
```

### Investigate failures
```bash
crawlx failures --domain example.com
```

### Check service health
```bash
crawlx health
```

### Start or stop infrastructure
```bash
crawlx up
crawlx down
```

## Safety Rules

- Always set domain policy before bulk crawling a new domain
- Respect robots.txt (enforced by default)
- Do not attempt to bypass login walls or CAPTCHAs
- Do not scrape blocked domains (social media, etc.)
- Check `crawlx health` before starting large jobs

## Error Handling

If a scrape fails, CrawlX automatically tries multiple engines (Firecrawl → Playwright → branded browser). Check the failure class with `crawlx failures --domain <domain>`.