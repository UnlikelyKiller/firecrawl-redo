import { Result, ok, err } from 'neverthrow';

export interface RobotsRule {
  readonly userAgent: string;
  readonly path: string;
  readonly allow: boolean;
}

interface CacheEntry {
  readonly rules: ReadonlyArray<RobotsRule>;
  readonly crawlDelayMs: number | undefined;
  readonly fetchedAt: number;
}

export class RobotsParser {
  private readonly cache: Map<string, CacheEntry> = new Map();

  constructor(
    private readonly cacheTtlMs: number = 86400000,
    private readonly fetchFn: (url: string) => Promise<Result<string, Error>> = defaultFetch,
  ) {}

  async isAllowed(url: string, userAgent: string = 'CrawlX'): Promise<Result<boolean, Error>> {
    const parsedResult = extractDomainAndPath(url);
    if (parsedResult.isErr()) {
      return err(parsedResult.error);
    }

    const { domain, path, protocol } = parsedResult.value;
    const cached = this.getCacheEntry(domain);

    let rules: ReadonlyArray<RobotsRule>;
    let crawlDelay: number | undefined;

    if (cached) {
      rules = cached.rules;
      crawlDelay = cached.crawlDelayMs;
    } else {
      const robotsUrl = `${protocol}//${domain}/robots.txt`;
      const fetchResult = await this.fetchFn(robotsUrl);

      if (fetchResult.isErr()) {
        return ok(true);
      }

      const parsed = this.parseRobotsTxt(fetchResult.value);
      crawlDelay = parsed.crawlDelayMs;
      rules = parsed.rules;

      this.cache.set(domain, {
        rules,
        crawlDelayMs: crawlDelay,
        fetchedAt: Date.now(),
      });
    }

    const matchingRules = rules.filter(
      r => r.userAgent === userAgent || r.userAgent === '*',
    );

    if (matchingRules.length === 0) {
      return ok(true);
    }

    const sorted = [...matchingRules].sort((a, b) => {
      const specificityDiff = b.path.length - a.path.length;
      if (specificityDiff !== 0) return specificityDiff;
      if (a.allow !== b.allow) return a.allow ? -1 : 1;
      return 0;
    });

    for (const rule of sorted) {
      if (pathMatchesRule(rule.path, path)) {
        return ok(rule.allow);
      }
    }

    return ok(true);
  }

  parseRobotsTxt(content: string): { rules: ReadonlyArray<RobotsRule>; crawlDelayMs: number | undefined } {
    const rules: RobotsRule[] = [];
    let crawlDelayMs: number | undefined;
    let currentUserAgent = '';

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('#') || line.length === 0) continue;

      const commentIndex = line.indexOf('#');
      const cleaned = (commentIndex >= 0 ? line.slice(0, commentIndex) : line).trim();

      const colonIndex = cleaned.indexOf(':');
      if (colonIndex === -1) continue;

      const directive = cleaned.slice(0, colonIndex).trim().toLowerCase();
      const value = cleaned.slice(colonIndex + 1).trim();

      if (directive === 'user-agent') {
        currentUserAgent = value;
        continue;
      }

      if (directive === 'crawl-delay' && currentUserAgent) {
        const delay = parseFloat(value);
        if (!isNaN(delay) && delay >= 0) {
          crawlDelayMs = delay * 1000;
        }
        continue;
      }

      if (directive === 'disallow' && currentUserAgent) {
        if (value.length > 0) {
          rules.push({ userAgent: currentUserAgent, path: value, allow: false });
        }
        continue;
      }

      if (directive === 'allow' && currentUserAgent) {
        if (value.length > 0) {
          rules.push({ userAgent: currentUserAgent, path: value, allow: true });
        }
        continue;
      }
    }

    return { rules, crawlDelayMs };
  }

  private getCacheEntry(domain: string): CacheEntry | undefined {
    const entry = this.cache.get(domain);
    if (!entry) return undefined;
    if (Date.now() - entry.fetchedAt > this.cacheTtlMs) {
      this.cache.delete(domain);
      return undefined;
    }
    return entry;
  }
}

function extractDomainAndPath(
  url: string,
): Result<{ domain: string; path: string; protocol: string }, Error> {
  try {
    const parsed = new URL(url);
    return ok({
      domain: parsed.host,
      path: parsed.pathname,
      protocol: parsed.protocol === 'https:' ? 'https:' : 'http:',
    });
  } catch {
    return err(new Error(`Invalid URL: ${url}`));
  }
}

function pathMatchesRule(rulePath: string, urlPath: string): boolean {
  if (rulePath === urlPath) return true;

  if (!rulePath.includes('*') && !rulePath.includes('$')) {
    return urlPath.startsWith(rulePath);
  }

  let pattern = '';
  let i = 0;

  while (i < rulePath.length) {
    const ch = rulePath[i];
    if (ch === '*') {
      pattern += '.*';
      i += 1;
    } else if (ch === '$') {
      if (i === rulePath.length - 1) {
        pattern += '$';
      } else {
        pattern += '\\$';
      }
      i += 1;
    } else if (ch !== undefined && '.+?[](){}|^\\'.includes(ch)) {
      pattern += `\\${ch}`;
      i += 1;
    } else if (ch !== undefined) {
      pattern += ch;
      i += 1;
    }
  }

  if (!rulePath.endsWith('$')) {
    pattern += '.*';
  }

  try {
    return new RegExp(`^${pattern}$`).test(urlPath);
  } catch {
    return false;
  }
}

async function defaultFetch(url: string): Promise<Result<string, Error>> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!response.ok) {
      return err(new Error(`HTTP ${response.status}`));
    }
    const text = await response.text();
    return ok(text);
  } catch (e) {
    return err(new Error(`Failed to fetch robots.txt: ${e instanceof Error ? e.message : String(e)}`));
  }
}