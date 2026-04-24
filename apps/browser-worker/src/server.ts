import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from '@fastify/type-provider-zod';
import { z } from 'zod';
import { BrowserPool } from './browser-pool.js';
import { ContentAddressedStore } from '../../../packages/artifact-store/src/index.js';
import { ScrapeHandler } from './scrape-handler.js';
import type { RecipeAction } from './recipe-runner.js';

export const ScrapeRequestBody = z.object({
  url: z.string().url(),
  waitFor: z.number().optional(),
  actions: z.array(z.object({
    type: z.enum([
      'goto',
      'click',
      'fill',
      'press',
      'select',
      'waitForSelector',
      'scroll',
      'screenshot',
      'extractHtml',
      'extractText',
    ]),
    selector: z.string().optional(),
    value: z.string().optional(),
    key: z.string().optional(),
    direction: z.enum(['up', 'down']).optional(),
    amount: z.number().optional(),
    fullPage: z.boolean().optional(),
    url: z.string().optional(),
    timeout: z.number().optional(),
  })).optional(),
  captureScreenshot: z.boolean().optional().default(true),
  captureHar: z.boolean().optional().default(true),
  captureAria: z.boolean().optional().default(true),
  captureVideo: z.boolean().optional().default(false),
  captureConsole: z.boolean().optional().default(true),
  timeoutMs: z.number().optional().default(30000),
});

export type ScrapeRequest = z.infer<typeof ScrapeRequestBody>;

const ScrapeResponseSchema = z.object({
  success: z.boolean(),
  hashes: z.record(z.string(), z.string()).optional(),
  statusCode: z.number(),
  url: z.string(),
  title: z.string(),
  engineName: z.string(),
  error: z.string().optional(),
});

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  activeContexts: z.number(),
  uptime: z.number(),
});

type RawAction = {
  type: string;
  selector?: string | undefined;
  value?: string | undefined;
  key?: string | undefined;
  direction?: 'up' | 'down' | undefined;
  amount?: number | undefined;
  fullPage?: boolean | undefined;
  url?: string | undefined;
  timeout?: number | undefined;
};

function mapToRecipeAction(raw: RawAction): RecipeAction | undefined {
  switch (raw.type) {
    case 'goto':
      if (!raw.url) return undefined;
      return raw.timeout !== undefined
        ? { type: 'goto' as const, url: raw.url, timeout: raw.timeout }
        : { type: 'goto' as const, url: raw.url };
    case 'click':
      if (!raw.selector) return undefined;
      return raw.timeout !== undefined
        ? { type: 'click' as const, selector: raw.selector, timeout: raw.timeout }
        : { type: 'click' as const, selector: raw.selector };
    case 'fill':
      if (!raw.selector || !raw.value) return undefined;
      return raw.timeout !== undefined
        ? { type: 'fill' as const, selector: raw.selector, value: raw.value, timeout: raw.timeout }
        : { type: 'fill' as const, selector: raw.selector, value: raw.value };
    case 'press':
      if (!raw.selector || !raw.key) return undefined;
      return raw.timeout !== undefined
        ? { type: 'press' as const, selector: raw.selector, key: raw.key, timeout: raw.timeout }
        : { type: 'press' as const, selector: raw.selector, key: raw.key };
    case 'select':
      if (!raw.selector || !raw.value) return undefined;
      return raw.timeout !== undefined
        ? { type: 'select' as const, selector: raw.selector, value: raw.value, timeout: raw.timeout }
        : { type: 'select' as const, selector: raw.selector, value: raw.value };
    case 'waitForSelector':
      if (!raw.selector) return undefined;
      return raw.timeout !== undefined
        ? { type: 'waitForSelector' as const, selector: raw.selector, timeout: raw.timeout }
        : { type: 'waitForSelector' as const, selector: raw.selector };
    case 'scroll': {
      const base = { type: 'scroll' as const, direction: raw.direction ?? 'down' as const };
      return raw.amount !== undefined
        ? { ...base, amount: raw.amount }
        : base;
    }
    case 'screenshot':
      return raw.fullPage !== undefined
        ? { type: 'screenshot' as const, fullPage: raw.fullPage }
        : { type: 'screenshot' as const };
    case 'extractHtml':
      return { type: 'extractHtml' as const };
    case 'extractText':
      return { type: 'extractText' as const };
    default:
      return undefined;
  }
}

export async function buildServer(
  pool: BrowserPool,
  store: ContentAddressedStore,
) {
  const app = Fastify.default();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const handler = new ScrapeHandler(pool, store);

  app.get('/health', {
    schema: { response: { 200: HealthResponseSchema } },
  }, async () => ({
    status: 'ok' as const,
    activeContexts: pool.getActiveContextCount(),
    uptime: process.uptime(),
  }));

  app.post('/scrape', {
    schema: {
      body: ScrapeRequestBody,
      response: {
        200: ScrapeResponseSchema,
        500: ScrapeResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as ScrapeRequest;

    const recipeActions: RecipeAction[] | undefined = body.actions
      ?.map((a: RawAction) => mapToRecipeAction(a))
      .filter((a: RecipeAction | undefined): a is RecipeAction => a !== undefined);

    const result = await handler.handle(
      body.url,
      body.waitFor,
      recipeActions,
      {
        captureScreenshot: body.captureScreenshot,
        captureHar: body.captureHar,
        captureAria: body.captureAria,
        captureVideo: body.captureVideo,
        captureConsole: body.captureConsole,
      },
      body.timeoutMs,
    );

    if (result.isErr()) {
      return reply.code(500).send({
        success: false,
        statusCode: 500,
        url: body.url,
        title: '',
        engineName: 'browser-worker',
        error: result.error.message,
      });
    }

    const value = result.value;
    const hashRecord: Record<string, string> = {};
    const hashes = value.hashes;
    if (hashes.renderedHtmlHash) hashRecord.renderedHtml = hashes.renderedHtmlHash;
    if (hashes.visibleTextHash) hashRecord.visibleText = hashes.visibleTextHash;
    if (hashes.screenshotFullHash) hashRecord.screenshotFull = hashes.screenshotFullHash;
    if (hashes.screenshotViewportHash) hashRecord.screenshotViewport = hashes.screenshotViewportHash;
    if (hashes.ariaSnapshotHash) hashRecord.ariaSnapshot = hashes.ariaSnapshotHash;
    if (hashes.harHash) hashRecord.har = hashes.harHash;
    if (hashes.consoleLogHash) hashRecord.consoleLog = hashes.consoleLogHash;
    if (hashes.metadataHash) hashRecord.metadata = hashes.metadataHash;

    return {
      success: true,
      hashes: hashRecord,
      statusCode: value.statusCode,
      url: value.url,
      title: value.title,
      engineName: value.engineName,
    };
  });

  return app;
}

export async function startServer(): Promise<void> {
  const port = Number(process.env.BROWSER_WORKER_PORT ?? '3100');
  const storeDir = process.env.ARTIFACT_STORE_DIR ?? '/tmp/crawlx-artifacts';

  const pool = new BrowserPool({ maxContexts: 5 });
  const initResult = await pool.initialize();
  if (initResult.isErr()) {
    console.error('Failed to initialize browser pool:', initResult.error);
    process.exit(1);
  }

  const store = new ContentAddressedStore(storeDir);
  const app = await buildServer(pool, store);

  try {
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Browser worker listening on port ${port}`);
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await pool.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}