import { Router } from "express";
import { db } from "../../../lib/db";
import { jobs, llmCalls } from "@crawlx/db";
import { count, sql } from "drizzle-orm";

export const statsRouter = Router();

statsRouter.get("/", async (req, res) => {
  try {
    const [jobCount] = await db.select({ value: count() }).from(jobs);
    const [llmCount] = await db.select({ value: count() }).from(llmCalls);

    // Aggregate success rate
    const [successCount] = await db
      .select({ value: count() })
      .from(jobs)
      .where(sql`${jobs.status} = 'completed'`);

    res.json({
      stats: {
        totalJobs: jobCount?.value ?? 0,
        totalLlmCalls: llmCount?.value ?? 0,
        successRate: jobCount?.value
          ? (successCount?.value ?? 0) / jobCount.value
          : 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
