import { Router } from "express";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { AgentRequestSchema } from "@crawlx/firecrawl-compat";
import {
  WaterfallOrchestrator,
  FirecrawlStaticEngine,
  FirecrawlJsEngine,
  FirecrawlPlaywrightEngine,
  CrawlxPlaywrightEngine,
  CrawlxBrandedBrowserEngine,
  MultiloginCdpEngine,
  CrawlxRecipeEngine,
  ManualReviewEngine,
  FirecrawlCloudEngine,
} from "@crawlx/waterfall-engine";
import { FirecrawlClient } from "@crawlx/firecrawl-client";
import {
  ExtractionPipeline,
  ModelRouter,
  OllamaAdapter,
  type LLMLogger,
  type LLMUsage,
} from "@crawlx/model-adapter";
import { SearXNGProvider } from "@crawlx/search-provider";
import { db } from "../../../lib/db";
import { llmCalls } from "@crawlx/db";
import { config } from "../../../config";
import { resolveMultiloginRoutePolicy } from "./multilogin";

export const agentRouter = Router();

/**
 * Basic JSON Schema to Zod converter.
 */
function jsonSchemaToZod(jsonSchema: any): z.ZodType {
  if (!jsonSchema || typeof jsonSchema !== "object") {
    return z.any();
  }

  const type = jsonSchema.type;

  switch (type) {
    case "string":
      return z.string();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "integer":
      return z.number().int();
    case "object":
      const properties: Record<string, z.ZodType> = {};
      if (jsonSchema.properties) {
        for (const [key, val] of Object.entries(jsonSchema.properties)) {
          properties[key] = jsonSchemaToZod(val);
        }
      }
      const shape = z.object(properties);
      if (Array.isArray(jsonSchema.required)) {
        const requiredSet = new Set(jsonSchema.required);
        const finalProperties: Record<string, z.ZodType> = {};
        for (const key of Object.keys(properties)) {
          finalProperties[key] = requiredSet.has(key)
            ? properties[key]
            : properties[key].optional();
        }
        return z.object(finalProperties);
      }
      return shape;
    case "array":
      if (jsonSchema.items) {
        return z.array(jsonSchemaToZod(jsonSchema.items));
      }
      return z.array(z.any());
    default:
      return z.any();
  }
}

class DBLLMLogger implements LLMLogger {
  constructor(private readonly jobId?: string) {}

  async logCall(params: {
    readonly model: string;
    readonly system: string;
    readonly user: string;
    readonly response: string;
    readonly usage: LLMUsage;
    readonly error?: string;
  }): Promise<void> {
    await db.insert(llmCalls).values({
      jobId: this.jobId as any,
      provider: "ollama",
      model: params.model,
      tokensIn: params.usage.promptTokens,
      tokensOut: params.usage.completionTokens,
      latencyMs: params.usage.latencyMs,
      status: params.error ? "FAILURE" : "SUCCESS",
      request: {
        system: params.system,
        user: params.user,
      },
      response: params.response ? { data: params.response } : null,
      error: params.error,
      correlationId: uuidv7(),
    });
  }
}

// Initialize Firecrawl Client
const firecrawlClient = new FirecrawlClient({
  host: config.FIRECRAWL_APP_HOST,
  port: parseInt(config.FIRECRAWL_APP_PORT),
  protocol: config.FIRECRAWL_APP_SCHEME as "http" | "https",
});

const searchProvider = new SearXNGProvider(
  config.SEARXNG_ENDPOINT || "http://localhost:8080",
);

async function buildOrchestrator(
  url: string,
): Promise<
  { orchestrator: WaterfallOrchestrator } | { error: string; status: number }
> {
  const multiloginPolicy = await resolveMultiloginRoutePolicy(url);
  if (multiloginPolicy.required && !multiloginPolicy.eligible) {
    return {
      error: multiloginPolicy.error ?? "Multilogin is required for this domain",
      status: 412,
    };
  }

  const multiloginEngines = multiloginPolicy.eligible
    ? [
        new MultiloginCdpEngine({
          baseUrl: config.MULTILOGIN_BRIDGE_URL,
          profileId: multiloginPolicy.profileId,
          apiToken: config.MULTILOGIN_TOKEN,
          allowedDomains: multiloginPolicy.allowedDomains,
        }),
      ]
    : [];
  const engines = multiloginPolicy.required
    ? multiloginEngines
    : [
        new FirecrawlStaticEngine(firecrawlClient),
        new FirecrawlJsEngine(firecrawlClient),
        new FirecrawlPlaywrightEngine(firecrawlClient),
        new CrawlxPlaywrightEngine({
          baseUrl:
            config.PLAYWRIGHT_MICROSERVICE_URL || "http://localhost:3005",
        }),
        new CrawlxBrandedBrowserEngine({
          baseUrl:
            config.PLAYWRIGHT_MICROSERVICE_URL || "http://localhost:3005",
        }),
        ...multiloginEngines,
        new CrawlxRecipeEngine({
          baseUrl:
            config.PLAYWRIGHT_MICROSERVICE_URL || "http://localhost:3005",
        }),
        new ManualReviewEngine(),
        new FirecrawlCloudEngine({
          apiKey: config.OPENAI_API_KEY || "",
        }),
      ];

  return { orchestrator: new WaterfallOrchestrator(engines) };
}

agentRouter.post("/", async (req, res) => {
  try {
    const parseResult = AgentRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res
        .status(400)
        .json({ success: false, error: parseResult.error.message });
    }

    const { prompt, maxPages, schema: userSchema, model } = parseResult.data;
    const jobId = uuidv7();

    // Convert schema if provided
    const zodSchema = userSchema ? jsonSchemaToZod(userSchema) : z.any();

    // 1. Search
    const searchResult = await searchProvider.search(prompt, maxPages);
    if (searchResult.isErr()) {
      return res
        .status(500)
        .json({
          success: false,
          error: `Search failed: ${searchResult.error.message}`,
        });
    }

    const results = searchResult.value.results;
    const extractedData: any[] = [];
    const skipped: Array<{ url: string; reason: string }> = [];

    // 2. Loop: Scrape -> Extract
    for (const result of results) {
      const orchestratorResult = await buildOrchestrator(result.url);
      if ("error" in orchestratorResult) {
        skipped.push({ url: result.url, reason: orchestratorResult.error });
        continue;
      }

      const scrapeResult = await orchestratorResult.orchestrator.scrape({
        url: result.url,
        formats: ["markdown"],
      });

      if (scrapeResult.isOk()) {
        const markdown = scrapeResult.value.response.data?.markdown;
        if (markdown) {
          const ollamaAdapter = new OllamaAdapter({
            baseUrl: config.OLLAMA_BASE_URL || "http://localhost:11434",
            model: model || config.MODEL_NAME || "llama3",
          });

          const modelRouter = new ModelRouter([ollamaAdapter]);
          const logger = new DBLLMLogger(jobId);
          const pipeline = new ExtractionPipeline(modelRouter, {
            logger,
            maxRepairAttempts: 2,
          });

          const extractionResult = await pipeline.extract(markdown, zodSchema, {
            jobId,
          });

          if (extractionResult.isOk()) {
            extractedData.push({
              url: result.url,
              data: extractionResult.value.data,
            });
          }
        }
      }
    }

    res.json({
      success: true,
      jobId,
      data: extractedData,
      skipped,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
