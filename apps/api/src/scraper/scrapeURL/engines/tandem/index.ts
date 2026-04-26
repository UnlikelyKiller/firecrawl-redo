import { config } from "../../../../config";
import { EngineScrapeResult } from "..";
import { Meta } from "../..";
import { TandemBrowserEngine } from "@crawlx/waterfall-engine";

export async function scrapeURLWithTandem(
  meta: Meta,
): Promise<EngineScrapeResult> {
  const engine = new TandemBrowserEngine({
    baseUrl: config.CRAWLX_TANDEM_BASE_URL,
    apiToken: config.CRAWLX_TANDEM_API_TOKEN,
    timeoutMs: meta.abort.scrapeTimeout(),
  });

  const result = await engine.scrape({
    url: meta.rewrittenUrl ?? meta.url,
  });

  if (result.isErr()) {
    throw result.error;
  }

  const { data } = result.value;

  return {
    url: data.metadata?.sourceUrl ?? meta.rewrittenUrl ?? meta.url,
    html: data.rawHtml || data.html || "",
    markdown: data.markdown,
    statusCode: data.metadata?.statusCode ?? 200,
    error: undefined,
    contentType: data.metadata?.contentType,
    proxyUsed: "basic", // Tandem handles its own proxy
    metadata: data.metadata,
  } as EngineScrapeResult;
}

export function tandemMaxReasonableTime(meta: Meta): number {
  return (meta.options.waitFor ?? 0) + 30000;
}
