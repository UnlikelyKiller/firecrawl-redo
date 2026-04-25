import { Router } from "express";
import { db } from "../../../lib/db";
import { engineAttempts } from "@crawlx/db";
import { desc, sql, ne } from "drizzle-orm";

export const failuresRouter = Router();

failuresRouter.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const offset = (page - 1) * per_page;

    const failures = await db
      .select()
      .from(engineAttempts)
      .where(ne(engineAttempts.status, "success"))
      .orderBy(desc(engineAttempts.createdAt))
      .limit(per_page)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(engineAttempts)
      .where(ne(engineAttempts.status, "success"));

    const total = Number(count);
    const total_pages = Math.ceil(total / per_page);

    const data = failures.map(row => ({
      id: row.id,
      job_id: row.jobId,
      url: "",
      engine: row.engineName,
      error_class: row.error ?? "Unknown",
      error_message: row.error ?? "Unknown error",
      occurred_at: row.createdAt?.toISOString() ?? "",
      domain: "",
    }));

    res.json({ data, total, page, per_page, total_pages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

failuresRouter.get("/groups", async (req, res) => {
  try {
    const groups = await db
      .select({
        error: engineAttempts.error,
        count: sql<number>`count(*)`,
        latestAt: sql<string>`max(${engineAttempts.createdAt})::text`,
      })
      .from(engineAttempts)
      .where(ne(engineAttempts.status, "success"))
      .groupBy(engineAttempts.error)
      .orderBy(desc(sql`count(*)`));

    const result = groups.map(g => ({
      error_class: g.error ?? "Unknown",
      count: Number(g.count),
      domains: [] as string[],
      latest_at: g.latestAt ?? new Date().toISOString(),
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

failuresRouter.get("/engines", async (req, res) => {
  try {
    const stats = await db
      .select({
        engineName: engineAttempts.engineName,
        successCount: sql<number>`count(*) FILTER (WHERE status = 'success')`,
        totalCount: sql<number>`count(*)`,
      })
      .from(engineAttempts)
      .groupBy(engineAttempts.engineName);

    const result = stats.map(s => {
      const total = Number(s.totalCount);
      const succeeded = Number(s.successCount);
      return {
        engine: s.engineName,
        total,
        succeeded,
        rate: total > 0 ? succeeded / total : 0,
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
