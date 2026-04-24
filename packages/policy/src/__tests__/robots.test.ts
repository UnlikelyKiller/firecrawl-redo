import { describe, it, expect } from 'vitest';
import { RobotsParser } from '../robots';
import { ok, err } from 'neverthrow';

describe('RobotsParser', () => {
  describe('parseRobotsTxt', () => {
    it('parses disallow rules', () => {
      const parser = new RobotsParser();
      const content = [
        'User-agent: *',
        'Disallow: /admin/',
        'Disallow: /private',
      ].join('\n');

      const result = parser.parseRobotsTxt(content);
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0]!).toEqual({
        userAgent: '*',
        path: '/admin/',
        allow: false,
      });
      expect(result.rules[1]!).toEqual({
        userAgent: '*',
        path: '/private',
        allow: false,
      });
    });

    it('parses allow rules', () => {
      const parser = new RobotsParser();
      const content = [
        'User-agent: CrawlX',
        'Allow: /public/',
        'Disallow: /',
      ].join('\n');

      const result = parser.parseRobotsTxt(content);
      expect(result.rules).toHaveLength(2);
    });

    it('parses crawl-delay', () => {
      const parser = new RobotsParser();
      const content = [
        'User-agent: CrawlX',
        'Crawl-delay: 5',
      ].join('\n');

      const result = parser.parseRobotsTxt(content);
      expect(result.crawlDelayMs).toBe(5000);
    });

    it('handles comments', () => {
      const parser = new RobotsParser();
      const content = [
        '# This is a comment',
        'User-agent: *',
        '# Another comment',
        'Disallow: /tmp/',
      ].join('\n');

      const result = parser.parseRobotsTxt(content);
      expect(result.rules).toHaveLength(1);
    });

    it('handles empty disallow (allow everything)', () => {
      const parser = new RobotsParser();
      const content = [
        'User-agent: *',
        'Disallow:',
      ].join('\n');

      const result = parser.parseRobotsTxt(content);
      expect(result.rules).toHaveLength(0);
    });

    it('handles multiple user-agents', () => {
      const parser = new RobotsParser();
      const content = [
        'User-agent: GoogleBot',
        'Disallow: /secret/',
        '',
        'User-agent: *',
        'Disallow: /admin/',
      ].join('\n');

      const result = parser.parseRobotsTxt(content);
      expect(result.rules).toHaveLength(2);
      expect(result.rules.find(r => r.userAgent === 'GoogleBot')).toBeDefined();
      expect(result.rules.find(r => r.userAgent === '*')).toBeDefined();
    });

    it('handles wildcards in paths', () => {
      const parser = new RobotsParser();
      const content = [
        'User-agent: *',
        'Disallow: /search/*',
        'Allow: /search/api/*',
      ].join('\n');

      const result = parser.parseRobotsTxt(content);
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0]!.path).toBe('/search/*');
      expect(result.rules[1]!.path).toBe('/search/api/*');
    });

    it('handles inline comments', () => {
      const parser = new RobotsParser();
      const content = 'User-agent: * # inline comment';
      const result = parser.parseRobotsTxt(content);
      expect(result.rules).toHaveLength(0);
    });
  });

  describe('isAllowed', () => {
    it('disallows paths matching disallow rules', async () => {
      const parser = new RobotsParser(86400000, async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          return ok([
            'User-agent: *',
            'Disallow: /admin/',
          ].join('\n'));
        }
        return err(new Error('not found'));
      });

      const result = await parser.isAllowed('https://example.com/admin/settings');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(false);
      }
    });

    it('allows paths not matching any disallow rules', async () => {
      const parser = new RobotsParser(86400000, async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          return ok([
            'User-agent: *',
            'Disallow: /admin/',
          ].join('\n'));
        }
        return err(new Error('not found'));
      });

      const result = await parser.isAllowed('https://example.com/public/page');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(true);
      }
    });

    it('allows everything when robots.txt is unreachable (lenient)', async () => {
      const parser = new RobotsParser(86400000, async () => {
        return err(new Error('connection refused'));
      });

      const result = await parser.isAllowed('https://example.com/any/path');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(true);
      }
    });

    it('respects allow rules that override disallow', async () => {
      const parser = new RobotsParser(86400000, async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          return ok([
            'User-agent: *',
            'Disallow: /search/',
            'Allow: /search/api/',
          ].join('\n'));
        }
        return err(new Error('not found'));
      });

      const result = await parser.isAllowed('https://example.com/search/api/docs');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(true);
      }
    });

    it('handles wildcard patterns in disallow rules', async () => {
      const parser = new RobotsParser(86400000, async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          return ok([
            'User-agent: *',
            'Disallow: /*.pdf$',
          ].join('\n'));
        }
        return err(new Error('not found'));
      });

      const result = await parser.isAllowed('https://example.com/report.pdf');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(false);
      }
    });

    it('matches specific user-agent over wildcard', async () => {
      const parser = new RobotsParser(86400000, async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          return ok([
            'User-agent: *',
            'Disallow: /admin/',
            '',
            'User-agent: CrawlX',
            'Allow: /admin/',
          ].join('\n'));
        }
        return err(new Error('not found'));
      });

      const result = await parser.isAllowed('https://example.com/admin/dashboard', 'CrawlX');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(true);
      }
    });

    it('caches robots.txt results', async () => {
      let fetchCount = 0;
      const parser = new RobotsParser(86400000, async (url: string) => {
        if (url.endsWith('/robots.txt')) {
          fetchCount++;
          return ok([
            'User-agent: *',
            'Disallow: /private/',
          ].join('\n'));
        }
        return err(new Error('not found'));
      });

      await parser.isAllowed('https://example.com/page1');
      await parser.isAllowed('https://example.com/page2');

      expect(fetchCount).toBe(1);
    });
  });
});