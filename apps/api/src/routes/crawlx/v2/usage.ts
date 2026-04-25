import { Router } from "express";
import { db } from "../../../lib/db";
import { llmCalls, pages, engineAttempts } from "@crawlx/db";
import { sql, like } from "drizzle-orm";

export const usageRouter = Router();

usageRouter.get("/", async (req, res) => {
  try {
    const llmRows = await db
      .select({
        date: sql<string>`date(${llmCalls.createdAt})::text`,
        llm_tokens: sql<number>`sum(coalesce(${llmCalls.tokensIn}, 0) + coalesce(${llmCalls.tokensOut}, 0))`,
        cost_cents: sql<number>`sum(coalesce(${llmCalls.costEstimateCents}, 0))`,
      })
      .from(llmCalls)
      .groupBy(sql`date(${llmCalls.createdAt})`);

    const pageRows = await db
      .select({
        date: sql<string>`date(${pages.createdAt})::text`,
        count: sql<number>`count(*)`,
      })
      .from(pages)
      .groupBy(sql`date(${pages.createdAt})`);

    const browserRows = await db
      .select({
        date: sql<string>`date(${engineAttempts.createdAt})::text`,
        latency_ms: sql<number>`sum(coalesce(${engineAttempts.latencyMs}, 0))`,
      })
      .from(engineAttempts)
      .where(like(engineAttempts.engineName, "%browser%"))
      .groupBy(sql`date(${engineAttempts.createdAt})`);

    const dateMap = new Map<
      string,
      {
        llm_tokens: number;
        browser_seconds: number;
        pages_scraped: number;
        cost_cents: number;
      }
    >();

    const getOrCreate = (date: string) => {
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          llm_tokens: 0,
          browser_seconds: 0,
          pages_scraped: 0,
          cost_cents: 0,
        });
      }
      return dateMap.get(date)!;
    };

    for (const row of llmRows) {
      const entry = getOrCreate(row.date);
      entry.llm_tokens = Number(row.llm_tokens);
      entry.cost_cents = Number(row.cost_cents);
    }

    for (const row of pageRows) {
      const entry = getOrCreate(row.date);
      entry.pages_scraped = Number(row.count);
    }

    for (const row of browserRows) {
      const entry = getOrCreate(row.date);
      entry.browser_seconds = Math.round(Number(row.latency_ms) / 1000);
    }

    const result = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entry]) => ({ date, ...entry }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
