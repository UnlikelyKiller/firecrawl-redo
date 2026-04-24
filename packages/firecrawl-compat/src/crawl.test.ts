import { CrawlRequestSchema } from './crawl';

describe('CrawlRequestSchema', () => {
  it('should validate a valid crawl request', () => {
    const validRequest = {
      url: 'https://example.com',
      excludePaths: ['/blog/*'],
      maxDepth: 2,
    };
    const result = CrawlRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('should support v2.8 specific fields', () => {
    const v28Request = {
      url: 'https://example.com',
      sitemapOnly: true,
      ignoreCache: true,
      customHeaders: {
        'Authorization': 'Bearer token'
      },
      scrapeOptions: {
        formats: ['markdown'],
      },
      timeoutMs: 120000
    };
    const result = CrawlRequestSchema.safeParse(v28Request);
    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data.sitemapOnly).toBe(true);
        expect(result.data.ignoreCache).toBe(true);
        expect(result.data.timeoutMs).toBe(120000);
    }
  });
});
