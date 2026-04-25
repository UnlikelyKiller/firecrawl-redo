import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrapeRequest } from '../../../firecrawl-compat/src';
import { TandemBrowserEngine } from '../engines/tandem-browser';

const fakeRequest: ScrapeRequest = { url: 'https://example.com' };

// Helper: builds an ordered sequence of fetch responses for a successful scrape
// Order: GET /status, POST /tabs/open, POST /wait, GET /page-content, GET /page-html, POST /tabs/close
function makeSuccessfulFetchSequence(overrides: {
  text?: string;
  title?: string;
  html?: string;
  tabId?: string;
} = {}) {
  const text = overrides.text ?? 'Hello Tandem';
  const title = overrides.title ?? 'Tandem Page';
  const html = overrides.html ?? '<html><body>Hello Tandem</body></html>';
  const tabId = overrides.tabId ?? 'tab-001';

  return vi.fn()
    // 1. GET /status
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '{"ok":true}',
    })
    // 2. POST /tabs/open
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, tab: { id: tabId, webContentsId: 1 } }),
      text: async () => JSON.stringify({ ok: true, tab: { id: tabId, webContentsId: 1 } }),
    })
    // 3. POST /wait
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, ready: true }),
      text: async () => '{"ok":true,"ready":true}',
    })
    // 4. GET /page-content
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        title,
        url: 'https://example.com',
        description: 'Test page',
        text,
        length: text.length,
      }),
      text: async () => JSON.stringify({ title, url: 'https://example.com', description: 'Test page', text, length: text.length }),
    })
    // 5. GET /page-html
    .mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new Error('not json'); },
      text: async () => html,
    })
    // 6. POST /tabs/close
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '{"ok":true}',
    });
}

describe('TandemBrowserEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // Test 1
  it('exposes correct capability flags', () => {
    const engine = new TandemBrowserEngine();

    expect(engine.capabilities).toMatchObject({
      supportsScreenshots: true,
      supportsA11ySnapshot: true,
    });
    // Removed CDP/profile flags must NOT be present
    expect(engine.capabilities).not.toHaveProperty('usesCdp');
    expect(engine.capabilities).not.toHaveProperty('requiresProfileId');
    expect(engine.capabilities).not.toHaveProperty('supportsSessionReuse');
    expect(engine.capabilities).not.toHaveProperty('supportsProxyDelegation');
    expect(engine.capabilities).not.toHaveProperty('supportsCookies');
  });

  // Test 2
  it('returns NOT_CONFIGURED when apiToken is missing', async () => {
    const engine = new TandemBrowserEngine();

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('NOT_CONFIGURED');
      expect(result.error.engineName).toBe('tandem-browser');
      expect(result.error.details).toMatchObject({
        configured: false,
        missing: expect.arrayContaining(['apiToken']),
      });
      // Must NOT include old fields like tandemProfileId or baseUrl
      const missing = (result.error.details as { missing: string[] }).missing;
      expect(missing).not.toContain('tandemProfileId');
      expect(missing).not.toContain('baseUrl');
    }
  });

  // Test 3
  it('returns UPSTREAM_DOWN when health check fails (503)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service unavailable' }),
      text: async () => 'Service unavailable',
    }));

    const engine = new TandemBrowserEngine({ apiToken: 'tok-abc' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
    }
  });

  // Test 4
  it('returns UPSTREAM_DOWN when Tandem is unreachable (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      new TypeError('fetch failed: connection refused'),
    ));

    const engine = new TandemBrowserEngine({ apiToken: 'tok-abc' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
    }
  });

  // Test 5
  it('scrapes successfully: open tab → wait → page-content → page-html → close tab', async () => {
    const fetchMock = makeSuccessfulFetchSequence({
      text: 'Hello Tandem',
      title: 'Tandem Page',
      html: '<html><body>Hello Tandem</body></html>',
      tabId: 'tab-001',
    });
    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({
      apiToken: 'tok-abc',
    });

    const result = await engine.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data?.markdown).toBe('Hello Tandem');
      expect(result.value.data?.html).toContain('Hello Tandem');
      expect(result.value.data?.rawHtml).toContain('Hello Tandem');
      expect(result.value.data?.metadata?.title).toBe('Tandem Page');
      expect(result.value.data?.metadata?.engine).toBe('tandem-browser');
    }

    // Verify all 6 fetch calls were made in order
    expect(fetchMock).toHaveBeenCalledTimes(6);

    const calls = fetchMock.mock.calls;
    expect(calls[0]![0]).toMatch(/\/status$/);
    expect(calls[1]![0]).toMatch(/\/tabs\/open$/);
    expect(calls[2]![0]).toMatch(/\/wait$/);
    expect(calls[3]![0]).toMatch(/\/page-content$/);
    expect(calls[4]![0]).toMatch(/\/page-html$/);
    expect(calls[5]![0]).toMatch(/\/tabs\/close$/);
  });

  // Test 6
  it('closes the tab even when page-content fetch throws', async () => {
    const tabId = 'tab-abort';
    const fetchMock = vi.fn()
      // 1. GET /status
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }), text: async () => '{}' })
      // 2. POST /tabs/open
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, tab: { id: tabId, webContentsId: 1 } }),
        text: async () => '{}',
      })
      // 3. POST /wait
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, ready: true }), text: async () => '{}' })
      // 4. GET /page-content — throws
      .mockRejectedValueOnce(new Error('network failure on page-content'))
      // 5. POST /tabs/close (finally block)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }), text: async () => '{}' });

    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({ apiToken: 'tok-abc' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);

    // Should have called: status, open, wait, page-content(throws), close
    // page-html is skipped because page-content threw
    // close tab must still be called (5 total)
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const lastCall = fetchMock.mock.calls[4]!;
    expect(lastCall[0]).toMatch(/\/tabs\/close$/);
  });

  // Test 7
  it('maps 401 response to BLOCKED', async () => {
    const fetchMock = vi.fn()
      // 1. GET /status - ok
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }), text: async () => '{}' })
      // 2. POST /tabs/open - 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized: invalid api token' }),
        text: async () => 'Unauthorized',
      })
      // 3. POST /tabs/close (finally block even if tabId undefined, won't fire)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }), text: async () => '{}' });

    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({ apiToken: 'bad-token' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('BLOCKED');
    }
  });

  // Test 8
  it('maps 403 response to BLOCKED', async () => {
    const fetchMock = vi.fn()
      // 1. GET /status - ok
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }), text: async () => '{}' })
      // 2. POST /tabs/open - 403
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden: policy rejected' }),
        text: async () => 'Forbidden',
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }), text: async () => '{}' });

    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({ apiToken: 'tok-abc' });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('BLOCKED');
    }
  });

  // Test 9
  it('only supports approved domains when allowedDomains is set', () => {
    const engine = new TandemBrowserEngine({
      apiToken: 'tok-abc',
      allowedDomains: ['example.com'],
    });

    expect(engine.supports({ url: 'https://example.com' })).toBe(true);
    expect(engine.supports({ url: 'https://sub.example.com' })).toBe(true);
    expect(engine.supports({ url: 'https://other.com' })).toBe(false);
    expect(engine.supports({ url: 'https://notexample.com' })).toBe(false);
  });

  // Test 10
  it('supports any domain when allowedDomains is not set (only apiToken required)', () => {
    const engine = new TandemBrowserEngine({ apiToken: 'tok-abc' });

    expect(engine.supports({ url: 'https://example.com' })).toBe(true);
    expect(engine.supports({ url: 'https://other.com' })).toBe(true);
    expect(engine.supports({ url: 'https://anything.io' })).toBe(true);
  });

  it('does NOT support requests when apiToken is missing', () => {
    const engine = new TandemBrowserEngine();

    expect(engine.supports(fakeRequest)).toBe(false);
    expect(engine.supports({ url: 'https://example.com' })).toBe(false);
  });

  it('uses Bearer auth header (not x-tandem-secret)', async () => {
    const fetchMock = makeSuccessfulFetchSequence();
    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({ apiToken: 'my-secret-token' });
    await engine.scrape(fakeRequest);

    // Check that tabs/open call used Authorization: Bearer header
    const tabsOpenCall = fetchMock.mock.calls[1]!;
    const headers = tabsOpenCall[1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-secret-token');
    expect(headers).not.toHaveProperty('x-tandem-secret');
  });

  it('uses the default baseUrl of http://127.0.0.1:8765 when not specified', async () => {
    const fetchMock = makeSuccessfulFetchSequence();
    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({ apiToken: 'tok-abc' });
    await engine.scrape(fakeRequest);

    const statusCall = fetchMock.mock.calls[0]!;
    expect(statusCall[0]).toBe('http://127.0.0.1:8765/status');
  });

  it('respects a custom baseUrl', async () => {
    const fetchMock = makeSuccessfulFetchSequence();
    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({
      apiToken: 'tok-abc',
      baseUrl: 'http://tandem.local:9000',
    });
    await engine.scrape(fakeRequest);

    const statusCall = fetchMock.mock.calls[0]!;
    expect(statusCall[0]).toBe('http://tandem.local:9000/status');
  });
});
