import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrapeRequest } from '../../../firecrawl-compat/src';
import { MultiloginCdpEngine } from '../engines/multilogin-cdp';

const fakeRequest: ScrapeRequest = { url: 'https://example.com' };

const mockPage = {
  goto: vi.fn(),
  waitForLoadState: vi.fn(),
  content: vi.fn(),
  locator: vi.fn(),
  title: vi.fn(),
  url: vi.fn(),
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
describe('MultiloginCdpEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('exposes explicit capability flags', () => {
    const engine = new MultiloginCdpEngine();

    expect(engine.capabilities).toEqual({
      usesCdp: true,
      requiresProfileId: true,
      supportsHostedBrowser: true,
      supportsSessionReuse: true,
      supportsProxyDelegation: true,
      supportsScrape: true,
      supportsScreenshots: false,
      supportsCookies: false,
      supportsActions: false,
    });
  });

  it('returns NOT_CONFIGURED when required Multilogin options are missing', async () => {
    const engine = new MultiloginCdpEngine();

    const result = await engine.scrape(fakeRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('NOT_CONFIGURED');
      expect(result.error.engineName).toBe('multilogin-cdp');
      expect(result.error.details).toMatchObject({
        configured: false,
        implemented: true,
        missing: ['baseUrl', 'profileId', 'apiToken'],
      });
    }
  });

  it('scrapes through the bridge and releases the lease', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leaseId: 'lease-123',
          profileId: 'profile-123',
          cdpUrl: 'http://bridge.local/cdp/lease-123',
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ released: true }),
      });
    vi.stubGlobal('fetch', fetchMock);
    mockPage.goto.mockResolvedValue({ status: () => 200 });
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.content.mockResolvedValue('<html><body>Hello</body></html>');
    mockPage.locator.mockReturnValue({ innerText: vi.fn().mockResolvedValue('Hello') });
    mockPage.title.mockResolvedValue('Example');
    mockPage.url.mockReturnValue('https://example.com');
    mockContext.pages.mockReturnValue([mockPage]);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockBrowser.contexts.mockReturnValue([mockContext]);
    mockBrowser.close.mockResolvedValue(undefined);
    connectOverCDP.mockResolvedValue(mockBrowser);

    const engine = new MultiloginCdpEngine({
      baseUrl: 'https://multilogin.local',
      profileId: 'profile-123',
      apiToken: 'token-123',
      allowedDomains: ['example.com'],
      connectOverCdp: connectOverCDP,
    });

    const result = await engine.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.data?.markdown).toBe('Hello');
      expect(result.value.data?.html).toContain('Hello');
      expect(result.value.data?.metadata?.leaseId).toBe('lease-123');
    }
    expect(connectOverCDP).toHaveBeenCalledWith('http://bridge.local/cdp/lease-123', { timeout: 45000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('heartbeats the lease while the scrape is active', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leaseId: 'lease-123',
          profileId: 'profile-123',
          wsEndpoint: 'ws://bridge.local/cdp/lease-123/ws',
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          leaseId: 'lease-123',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    mockPage.goto.mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
      return { status: () => 200 };
    });
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.content.mockResolvedValue('<html><body>Hello</body></html>');
    mockPage.locator.mockReturnValue({ innerText: vi.fn().mockResolvedValue('Hello') });
    mockPage.title.mockResolvedValue('Example');
    mockPage.url.mockReturnValue('https://example.com');
    mockContext.pages.mockReturnValue([mockPage]);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockBrowser.contexts.mockReturnValue([mockContext]);
    mockBrowser.close.mockResolvedValue(undefined);
    connectOverCDP.mockResolvedValue(mockBrowser);

    const engine = new MultiloginCdpEngine({
      baseUrl: 'http://bridge.local',
      profileId: 'profile-123',
      apiToken: 'token-123',
      timeoutMs: 18_000,
      allowedDomains: ['example.com'],
      connectOverCdp: connectOverCDP,
    });

    const result = await engine.scrape(fakeRequest);

    expect(result.isOk()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://bridge.local/session/heartbeat', expect.objectContaining({
      method: 'POST',
    }));
    vi.useRealTimers();
  });

  it('only supports explicitly approved domains', () => {
    const engine = new MultiloginCdpEngine({
      allowedDomains: ['example.com'],
    });

    expect(engine.supports(fakeRequest)).toBe(true);
    expect(engine.supports({ url: 'https://sub.example.com' })).toBe(true);
    expect(engine.supports({ url: 'https://other.com' })).toBe(false);
  });

  it('does not support requests until domain approval is configured', () => {
    const engine = new MultiloginCdpEngine();

    expect(engine.supports(fakeRequest)).toBe(false);
  });

  it('maps bridge failures to upstream errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Profile already has an active lease' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const engine = new MultiloginCdpEngine({
      baseUrl: 'https://multilogin.local',
      profileId: 'profile-123',
      apiToken: 'token-123',
      allowedDomains: ['example.com'],
      connectOverCdp: connectOverCDP,
    });

    const result = await engine.scrape(fakeRequest);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UPSTREAM_DOWN');
      expect(result.error.message).toContain('active lease');
    }
  });
});
