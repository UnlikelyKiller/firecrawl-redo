import { chromium, type Browser, type BrowserContext } from 'playwright';
import { Result, ResultAsync, ok, err } from 'neverthrow';

export class BrowserPoolError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'BrowserPoolError';
    this.cause = cause;
  }
}

export interface BrowserPoolOptions {
  readonly maxContexts: number;
  readonly launchOptions?: Parameters<typeof chromium.launch>[0];
}

const DEFAULT_OPTIONS: BrowserPoolOptions = { maxContexts: 5 };

export class BrowserPool {
  private browser: Browser | null = null;
  private activeContexts = 0;

  constructor(private readonly options: BrowserPoolOptions = DEFAULT_OPTIONS) {}

  async initialize(): Promise<Result<void, BrowserPoolError>> {
    if (this.browser) {
      return ok(undefined);
    }

    const result = await ResultAsync.fromPromise(
      chromium.launch(this.options.launchOptions),
      (e) => new BrowserPoolError('Failed to launch browser', e),
    );

    if (result.isErr()) {
      return err(result.error);
    }

    this.browser = result.value;
    return ok(undefined);
  }

  async createContext(): Promise<Result<BrowserContext, BrowserPoolError>> {
    if (!this.browser) {
      return err(new BrowserPoolError('Browser not initialized. Call initialize() first.'));
    }

    if (this.activeContexts >= this.options.maxContexts) {
      return err(new BrowserPoolError(`Maximum contexts (${this.options.maxContexts}) reached.`));
    }

    const result = await ResultAsync.fromPromise(
      this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: false,
      }),
      (e) => new BrowserPoolError('Failed to create browser context', e),
    );

    if (result.isOk()) {
      this.activeContexts += 1;
    }

    return result;
  }

  async releaseContext(context: BrowserContext): Promise<void> {
    await context.close().catch(() => {});
    if (this.activeContexts > 0) {
      this.activeContexts -= 1;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.activeContexts = 0;
    }
  }

  getActiveContextCount(): number {
    return this.activeContexts;
  }
}