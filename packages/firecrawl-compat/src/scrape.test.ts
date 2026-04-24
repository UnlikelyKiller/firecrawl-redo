import { ScrapeRequestSchema } from './scrape';

describe('ScrapeRequestSchema', () => {
  it('should validate a valid scrape request', () => {
    const validRequest = {
      url: 'https://example.com',
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      includeRawHtml: false,
      timeout: 30000,
    };
    const result = ScrapeRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('should support v2.8 specific fields', () => {
    const v28Request = {
      url: 'https://example.com',
      ignoreCache: true,
      customHeaders: {
        'Authorization': 'Bearer token'
      },
      timeoutMs: 60000
    };
    const result = ScrapeRequestSchema.safeParse(v28Request);
    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data.ignoreCache).toBe(true);
        expect(result.data.customHeaders).toEqual({ 'Authorization': 'Bearer token' });
        expect(result.data.timeoutMs).toBe(60000);
    }
  });

  it('should fail on invalid URL', () => {
    const invalidRequest = {
      url: 'not-a-url',
    };
    const result = ScrapeRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });
});
