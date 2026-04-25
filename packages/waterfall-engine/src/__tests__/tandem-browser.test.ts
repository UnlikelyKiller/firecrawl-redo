import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrapeRequest } from '../../../firecrawl-compat/src';
import { TandemBrowserEngine } from '../engines/tandem-browser';

const fakeRequest: ScrapeRequest = { url: 'https://example.com' };

const mockPage = {
  goto: vi.fn(),
  waitForLoadState: vi.fn(),
  content: vi.fn(),
  locator: vi.fn(),
  title: vi.fn(),
  url: vi.fn(),
  accessibility: { snapshot: vi.fn() },
  screenshot: vi.fn(),
};
const mockContext = {
  pages: vi.fn(),
  newPage: vi.fn(),
};
const mockBrowser = {
  contexts: vi.fn(),
  newContext: vi.fn(),
  close: vi.fn(),
};
const connectOverCDP = vi.fn();

function makeHealthyFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', version: '1.0.0', ...overrides }),
    });
}

function makeAttachFetch(extra: Record<string, unknown> = {}) {
  return vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', version: '1.0.0' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        leaseId: 'lease-tandem-1',
        profileId: 'ext-profile-1',
        wsEndpoint: 'ws://tandem.local/session/lease-tandem-1',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        ...extra,
      }),
    })
    .mockResolvedValue({
      ok: true,
      json: async () => ({ released: true }),
    });
}

describe('TandemBrowserEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('exposes explicit capability flags', () => {
    const engine = new TandemBrowserEngine();

    expect(engine.capabilities).toMatchObject({
      usesCdp: true,
      requiresProfileId: true,
      supportsHostedBrowser: true,
      supportsSessionReuse: true,
      supportsProxyDelegation: true,
      supportsScrape: true,
      supportsScreenshots: true,
      supportsCookies: false,
      supportsA11ySnapshot: true,
    });
  });

  it('returns NOT_CONFIGURED when required Tandem options are missing', async () => {
    const engine = new TandemBrowserEngine();

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('NOT_CONFIGURED');
      expect(result.error.engineName).toBe('tandem-browser');
      expect(result.error.details).toMatchObject({
        configured: false,
        missing: expect.arrayContaining(['baseUrl', 'tandemProfileId', 'apiToken']),
      });
    }
  });

  it('returns UPSTREAM_DOWN when the Tandem health probe fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service unavailable' }),
    }));

    const engine = new TandemBrowserEngine({
      baseUrl: 'http://tandem.local',
      tandemProfileId: 'ext-profile-1',
      apiToken: 'tok-abc',
      allowedDomains: ['example.com'],
      connectOverCdp: connectOverCDP,
    });

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
    }
  });

  it('scrapes through Tandem and releases the lease', async () => {
    vi.stubGlobal('fetch', makeAttachFetch());
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.content.mockResolvedValue('<html><body>Hello Tandem</body></html>');
    mockPage.locator.mockReturnValue({ innerText: vi.fn().mockResolvedValue('Hello Tandem') });
    mockPage.title.mockResolvedValue('Tandem Page');
    mockPage.url.mockReturnValue('https://example.com');
    mockPage.screenshot.mockResolvedValue(Buffer.from('fake-png'));
    mockPage.accessibility.snapshot.mockResolvedValue({ role: 'WebArea', children: [] });
    mockContext.pages.mockReturnValue([mockPage]);
    mockBrowser.contexts.mockReturnValue([mockContext]);
    mockBrowser.close.mockResolvedValue(undefined);
    connectOverCDP.mockResolvedValue(mockBrowser);

    const engine = new TandemBrowserEngine({
      baseUrl: 'http://tandem.local',
      tandemProfileId: 'ext-profile-1',
      apiToken: 'tok-abc',
      allowedDomains: ['example.com'],
      connectOverCdp: connectOverCDP,
    });

    const result = await engine.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data?.markdown).toBe('Hello Tandem');
      expect(result.value.data?.html).toContain('Hello Tandem');
      expect(result.value.data?.metadata?.leaseId).toBe('lease-tandem-1');
      expect(result.value.data?.metadata?.engine).toBe('tandem-browser');
    }
    expect(connectOverCDP).toHaveBeenCalledWith(
      'ws://tandem.local/session/lease-tandem-1',
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('heartbeats the lease while the scrape is active', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leaseId: 'lease-tandem-1',
          profileId: 'ext-profile-1',
          wsEndpoint: 'ws://tandem.local/session/lease-tandem-1',
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({ success: true, leaseId: 'lease-tandem-1', expiresAt: new Date(Date.now() + 60_000).toISOString() }) });
    vi.stubGlobal('fetch', fetchMock);

    mockPage.goto.mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
      return { status: () => 200 };
    });
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.content.mockResolvedValue('<html><body>OK</body></html>');
    mockPage.locator.mockReturnValue({ innerText: vi.fn().mockResolvedValue('OK') });
    mockPage.title.mockResolvedValue('OK');
    mockPage.url.mockReturnValue('https://example.com');
    mockPage.screenshot.mockResolvedValue(Buffer.from('png'));
    mockPage.accessibility.snapshot.mockResolvedValue(null);
    mockContext.pages.mockReturnValue([mockPage]);
    mockBrowser.contexts.mockReturnValue([mockContext]);
    mockBrowser.close.mockResolvedValue(undefined);
    connectOverCDP.mockResolvedValue(mockBrowser);

    const engine = new TandemBrowserEngine({
      baseUrl: 'http://tandem.local',
      tandemProfileId: 'ext-profile-1',
      apiToken: 'tok-abc',
      timeoutMs: 18_000,
      allowedDomains: ['example.com'],
      connectOverCdp: connectOverCDP,
    });

    const result = await engine.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://tandem.local/session/heartbeat',
      expect.objectContaining({ method: 'POST' }),
    );
    vi.useRealTimers();
  });

  it('only supports explicitly approved domains', () => {
    const engine = new TandemBrowserEngine({ allowedDomains: ['example.com'] });

    expect(engine.supports(fakeRequest)).toBe(true);
    expect(engine.supports({ url: 'https://sub.example.com' })).toBe(true);
    expect(engine.supports({ url: 'https://other.com' })).toBe(false);
  });

  it('does not support requests until domain approval is configured', () => {
    const engine = new TandemBrowserEngine();

    expect(engine.supports(fakeRequest)).toBe(false);
  });

  it('maps Tandem auth failure to BLOCKED', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized: invalid api token' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({
      baseUrl: 'http://tandem.local',
      tandemProfileId: 'ext-profile-1',
      apiToken: 'bad-token',
      allowedDomains: ['example.com'],
      connectOverCdp: connectOverCDP,
    });

    const result = await engine.scrape(fakeRequest);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('BLOCKED');
    }
  });

  it('maps an active lease conflict to UPSTREAM_DOWN', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Profile already has an active lease' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const engine = new TandemBrowserEngine({
      baseUrl: 'http://tandem.local',
      tandemProfileId: 'ext-profile-1',
      apiToken: 'tok-abc',
      allowedDomains: ['example.com'],
      connectOverCdp: connectOverCDP,
    });

    const result = await engine.scrape(fakeRequest);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
    }
  });
});
