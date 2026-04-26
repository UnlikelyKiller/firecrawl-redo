import { Router } from "express";
import { db } from "../../../lib/db";
import { activityLog } from "@crawlx/db";
import { desc, sql, eq, and, ilike } from "drizzle-orm";

export const activityRouter = Router();

activityRouter.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const offset = (page - 1) * per_page;
    const correlation_id = req.query.correlation_id as string;

    const where = correlation_id ? eq(activityLog.entityId, correlation_id) : undefined;

    const logs = await db
      .select()
      .from(activityLog)
      .where(where)
      .orderBy(desc(activityLog.createdAt))
      .limit(per_page)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(activityLog)
      .where(where);

    const total = Number(count);
    const total_pages = Math.ceil(total / per_page);

    const data = logs.map(row => {
      const meta = row.metadata as Record<string, any> | null;
      return {
        id: row.id,
        timestamp: row.createdAt?.toISOString() ?? "",
        endpoint: meta?.path ?? row.event,
        method: meta?.method ?? row.entityType,
        correlation_id: row.entityId ?? "",
        response_status:
          meta?.statusCode ??
          (row.level === "ERROR" ? 500 : row.level === "WARN" ? 400 : 200),
        latency_ms: meta?.duration ?? 0,
      };
    });

    res.json({ data, total, page, per_page, total_pages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
