import type { Page, BrowserContext } from 'playwright';
import { ResultAsync, err } from 'neverthrow';
import { ContentAddressedStore } from '../../../packages/artifact-store/src/index.js';

export interface ArtifactBundle {
  readonly rawHtml?: string;
  readonly renderedHtml?: string;
  readonly markdown?: string;
  readonly visibleText?: string;
  readonly screenshotFull?: Buffer;
  readonly screenshotViewport?: Buffer;
  readonly ariaSnapshot?: string;
  readonly har?: object;
  readonly consoleLog: ReadonlyArray<string>;
  readonly videoReceipt?: Buffer;
  readonly actionTimeline?: ReadonlyArray<unknown>;
  readonly metadata: PageMetadata;
}

export interface PageMetadata {
  readonly url: string;
  readonly title: string;
  readonly statusCode: number;
  readonly contentType: string;
  readonly contentLength: number;
  readonly loadTimeMs: number;
}

export interface ArtifactHashes {
  readonly rawHtmlHash?: string;
  readonly renderedHtmlHash?: string;
  readonly markdownHash?: string;
  readonly visibleTextHash?: string;
  readonly screenshotFullHash?: string;
  readonly screenshotViewportHash?: string;
  readonly ariaSnapshotHash?: string;
  readonly harHash?: string;
  readonly videoReceiptHash?: string;
  readonly consoleLogHash?: string;
  readonly metadataHash?: string;
}

export interface CaptureOptions {
  readonly captureScreenshot?: boolean;
  readonly captureHar?: boolean;
  readonly captureAria?: boolean;
  readonly captureVideo?: boolean;
  readonly captureConsole?: boolean;
}

export class ArtifactCaptureError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ArtifactCaptureError';
    this.cause = cause;
  }
}

async function storeOrError(
  store: ContentAddressedStore,
  content: string | Buffer,
  extension: string,
): Promise<string> {
  const result = await store.store(content, extension);
  if (result.isErr()) {
    throw result.error;
  }
  return result.value;
}

export async function captureArtifacts(
  page: Page,
  context: BrowserContext,
  store: ContentAddressedStore,
  options: CaptureOptions,
  startTime: number,
): Promise<ResultAsync<ArtifactHashes, ArtifactCaptureError>> {
  return ResultAsync.fromPromise(
    (async () => {
      const hashes: {
        rawHtmlHash?: string;
        renderedHtmlHash?: string;
        markdownHash?: string;
        visibleTextHash?: string;
        screenshotFullHash?: string;
        screenshotViewportHash?: string;
        ariaSnapshotHash?: string;
        harHash?: string;
        videoReceiptHash?: string;
        consoleLogHash?: string;
        metadataHash?: string;
      } = {};

      const renderedHtml = await page.content();
      hashes.renderedHtmlHash = await storeOrError(store, renderedHtml, 'html');

      const visibleText = await page.innerText('body').catch(() => '');
      hashes.visibleTextHash = await storeOrError(store, visibleText, 'txt');

      if (options.captureScreenshot ?? true) {
        const viewportShot = await page.screenshot({ fullPage: false });
        hashes.screenshotViewportHash = await storeOrError(store, viewportShot, 'png');

        const fullShot = await page.screenshot({ fullPage: true });
        hashes.screenshotFullHash = await storeOrError(store, fullShot, 'png');
      }

      if (options.captureAria ?? true) {
        const ariaSnapshot = await page.ariaSnapshot();
        hashes.ariaSnapshotHash = await storeOrError(store, ariaSnapshot, 'yaml');
      }

      if (options.captureHar ?? true) {
        // Playwright 1.59+: HAR is often recorded at context level
        // We trigger a flush/export if needed, or read from recorded path
        // For this implementation, we assume the context was started with recordHar
        try {
           const har = await context.har?.export();
           if (har) {
             hashes.harHash = await storeOrError(store, har, 'har');
           }
        } catch (e) {
           console.warn('Failed to export HAR', e);
        }
      }

      if (options.captureVideo ?? true) {
        const video = page.video();
        if (video) {
          try {
            const path = await video.path();
            const fs = await import('fs/promises');
            const videoBuffer = await fs.readFile(path);
            hashes.videoReceiptHash = await storeOrError(store, videoBuffer, 'webm');
          } catch (e) {
            console.warn('Failed to capture video receipt', e);
          }
        }
      }

      if (options.captureConsole ?? true) {
        const consoleLog: string[] = [];
        page.on('console', (msg) => {
          consoleLog.push(`[${msg.type()}] ${msg.text()}`);
        });
        hashes.consoleLogHash = await storeOrError(store, JSON.stringify(consoleLog), 'json');
      }

      const loadTimeMs = Date.now() - startTime;
      const metadata: PageMetadata = {
        url: page.url(),
        title: await page.title(),
        statusCode: 200,
        contentType: 'text/html',
        contentLength: renderedHtml.length,
        loadTimeMs,
      };
      hashes.metadataHash = await storeOrError(store, JSON.stringify(metadata), 'json');

      return hashes as ArtifactHashes;
    })(),
    (e) => new ArtifactCaptureError('Failed to capture artifacts', e),
  );
}