import { BrowserPool } from './browser-pool.js';
import { ContentAddressedStore } from '../../../packages/artifact-store/src/index.js';
import { captureArtifacts, type ArtifactHashes, type CaptureOptions } from './artifact-capture.js';
import { RecipeRunner, type RecipeAction } from './recipe-runner.js';
import { Result, ok, err } from 'neverthrow';

export interface ScrapeResult {
  readonly hashes: ArtifactHashes;
  readonly statusCode: number;
  readonly url: string;
  readonly title: string;
  readonly engineName: string;
}

export class ScrapeHandlerError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ScrapeHandlerError';
    this.cause = cause;
  }
}

export class ScrapeHandler {
  constructor(
    private readonly pool: BrowserPool,
    private readonly store: ContentAddressedStore,
    private readonly recipeRunner: RecipeRunner = new RecipeRunner(),
  ) {}

  async handle(
    url: string,
    waitFor: number | undefined,
    actions: ReadonlyArray<RecipeAction> | undefined,
    captureOptions: CaptureOptions,
    timeoutMs: number = 30_000,
    profile?: string,
  ): Promise<Result<ScrapeResult, ScrapeHandlerError>> {
    const contextResult = await this.pool.createContext(profile);
    if (contextResult.isErr()) {
      return err(new ScrapeHandlerError('Failed to acquire browser context', contextResult.error));
    }

    const context = contextResult.value;
    const startTime = Date.now();

    try {
      const page = await context.newPage();

      const response = await page.goto(url, {
        timeout: timeoutMs,
        waitUntil: 'domcontentloaded',
      }).catch((e: unknown) => {
        throw new ScrapeHandlerError(`Navigation to ${url} failed`, e);
      });

      if (waitFor && waitFor > 0) {
        await page.waitForTimeout(waitFor).catch(() => {});
      }

      if (actions && actions.length > 0) {
        const recipeResult = await this.recipeRunner.run(page, actions);
        if (recipeResult.isErr()) {
          return err(new ScrapeHandlerError('Recipe execution failed', recipeResult.error));
        }
        if (!recipeResult.value.success) {
          return err(new ScrapeHandlerError(`Recipe step failed: ${recipeResult.value.error ?? 'unknown'}`));
        }
      }

      const hashesResult = await captureArtifacts(page, context, this.store, captureOptions, startTime);
      if (hashesResult.isErr()) {
        return err(new ScrapeHandlerError('Artifact capture failed', hashesResult.error));
      }

      const title = await page.title().catch(() => '');
      const statusCode = response?.status() ?? 200;

      return ok({
        hashes: hashesResult.value,
        statusCode,
        url: page.url(),
        title,
        engineName: 'browser-worker',
      });
    } catch (e) {
      if (e instanceof ScrapeHandlerError) {
        return err(e);
      }
      return err(new ScrapeHandlerError('Unexpected scrape error', e));
    } finally {
      await this.pool.releaseContext(context);
    }
  }
}