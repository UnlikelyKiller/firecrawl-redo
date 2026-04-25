import { Router } from "express";
import { db } from "../../../lib/db";
import { llmCalls } from "@crawlx/db";
import { sql } from "drizzle-orm";

export const usageRouter = Router();

usageRouter.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        date: sql<string>`date(${llmCalls.createdAt})::text`,
        llm_tokens: sql<number>`sum(coalesce(${llmCalls.tokensIn}, 0) + coalesce(${llmCalls.tokensOut}, 0))`,
        cost_cents: sql<number>`sum(coalesce(${llmCalls.costEstimateCents}, 0))`,
      })
      .from(llmCalls)
      .groupBy(sql`date(${llmCalls.createdAt})`)
      .orderBy(sql`date(${llmCalls.createdAt})`);

    const result = rows.map(row => ({
      date: row.date,
      llm_tokens: Number(row.llm_tokens),
      browser_seconds: 0,
      pages_scraped: 0,
      cost_cents: Number(row.cost_cents),
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
