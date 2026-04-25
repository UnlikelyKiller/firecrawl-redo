import { jest } from "@jest/globals";

jest.mock("../../../lib/db", () => ({
  db: {},
}));

jest.mock("@crawlx/db", () => ({
  llmCalls: {},
  pages: {},
  engineAttempts: {},
}));

import { browserBackedEngineNames, isBrowserBackedEngineName } from "./usage";

describe("crawlx usage browser engine classification", () => {
  it("includes every browser-backed CrawlX engine name used by the route", () => {
    expect(browserBackedEngineNames).toEqual([
      "crawlx-branded-browser",
      "crawlx-playwright",
      "crawlx-recipe",
      "firecrawl-playwright",
    ]);

    expect(isBrowserBackedEngineName("crawlx-branded-browser")).toBe(true);
    expect(isBrowserBackedEngineName("crawlx-playwright")).toBe(true);
    expect(isBrowserBackedEngineName("crawlx-recipe")).toBe(true);
    expect(isBrowserBackedEngineName("firecrawl-playwright")).toBe(true);
  });

  it("does not classify non-browser CrawlX engines as browser-backed", () => {
    expect(isBrowserBackedEngineName("firecrawl-static")).toBe(false);
    expect(isBrowserBackedEngineName("firecrawl-js")).toBe(false);
    expect(isBrowserBackedEngineName("firecrawl-cloud")).toBe(false);
    expect(isBrowserBackedEngineName("manual-review")).toBe(false);
  });
});
