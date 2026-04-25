import { Router } from "express";
import { db } from "../../../lib/db";
import { llmCalls } from "@crawlx/db";
import { desc, sql } from "drizzle-orm";

export const extractionsRouter = Router();

extractionsRouter.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const offset = (page - 1) * per_page;

    const rows = await db
      .select()
      .from(llmCalls)
      .orderBy(desc(llmCalls.createdAt))
      .limit(per_page)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(llmCalls);

    const total = Number(count);
    const total_pages = Math.ceil(total / per_page);

    const data = rows.map(row => ({
      id: row.id,
      job_id: row.jobId ?? "",
      schema_id: "",
      status: (row.status === "SUCCESS" ? "completed" : "failed") as
        | "pending"
        | "completed"
        | "failed"
        | "validation_error",
      confidence: 0,
      created_at: row.createdAt?.toISOString() ?? "",
      validation_errors: undefined as readonly string[] | undefined,
    }));

    res.json({ data, total, page, per_page, total_pages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
