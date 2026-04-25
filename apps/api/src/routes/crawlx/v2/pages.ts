import { Router } from "express";
import { db } from "../../../lib/db";
import { pages } from "@crawlx/db";
import { desc, sql } from "drizzle-orm";

export const pagesRouter = Router();

pagesRouter.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 100;
    const offset = (page - 1) * per_page;

    const allPages = await db
      .select()
      .from(pages)
      .orderBy(desc(pages.createdAt))
      .limit(per_page)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pages);
    const total = Number(count);
    const total_pages = Math.ceil(total / per_page);

    const data = allPages.map(row => ({
      id: row.id,
      url: row.canonicalUrl,
      content_hash:
        row.markdownHash ?? row.rawHtmlHash ?? row.renderedHtmlHash ?? "",
      status: "scraped" as const,
      status_code: row.statusCode ?? undefined,
      last_scraped_at: row.createdAt?.toISOString() ?? "",
      change_indicator: undefined as
        | "new"
        | "changed"
        | "unchanged"
        | undefined,
    }));

    res.json({ data, total, page, per_page, total_pages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
