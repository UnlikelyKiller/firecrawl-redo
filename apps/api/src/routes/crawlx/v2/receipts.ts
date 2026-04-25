import { Router } from "express";
import { db } from "../../../lib/db";
import { pages } from "@crawlx/db";
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";

export const receiptsRouter = Router();

receiptsRouter.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const jobId =
      typeof req.query.job_id === "string" ? req.query.job_id : undefined;
    const offset = (page - 1) * per_page;
    const receiptPredicate = or(
      isNotNull(pages.videoReceiptHash),
      isNotNull(pages.harHash),
      isNotNull(pages.ariaSnapshotHash),
    );
    const filters = jobId
      ? and(receiptPredicate, eq(pages.jobId, jobId))
      : receiptPredicate;

    const receiptPages = await db
      .select()
      .from(pages)
      .where(filters)
      .orderBy(desc(pages.createdAt))
      .limit(per_page)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pages)
      .where(filters);

    const total = Number(count);
    const total_pages = Math.ceil(total / per_page);

    const data = receiptPages.map(row => ({
      id: row.id,
      job_id: row.jobId,
      url: row.canonicalUrl,
      video_url: row.videoReceiptHash
        ? `/api/artifacts/${row.videoReceiptHash}`
        : undefined,
      aria_snapshot: row.ariaSnapshotHash
        ? `/api/artifacts/${row.ariaSnapshotHash}`
        : undefined,
      action_timeline: [] as Array<{
        action: string;
        selector?: string;
        value?: string;
        timestamp: string;
        duration_ms: number;
      }>,
      created_at: row.createdAt?.toISOString() ?? "",
    }));

    res.json({ data, total, page, per_page, total_pages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
