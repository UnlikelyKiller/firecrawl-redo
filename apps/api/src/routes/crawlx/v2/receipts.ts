import { Router } from "express";
import { db } from "../../../lib/db";
import { pages } from "@crawlx/db";
import { desc, sql, or, isNotNull } from "drizzle-orm";

export const receiptsRouter = Router();

receiptsRouter.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const offset = (page - 1) * per_page;

    const receiptPages = await db
      .select()
      .from(pages)
      .where(or(isNotNull(pages.videoReceiptHash), isNotNull(pages.harHash)))
      .orderBy(desc(pages.createdAt))
      .limit(per_page)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pages)
      .where(or(isNotNull(pages.videoReceiptHash), isNotNull(pages.harHash)));

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
