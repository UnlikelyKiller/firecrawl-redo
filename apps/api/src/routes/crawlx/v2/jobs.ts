import { Router } from "express";
import { db } from "../../../lib/db";
import { jobs, engineAttempts, llmCalls, pages } from "@crawlx/db";
import { eq, desc, sql, count as drizzleCount } from "drizzle-orm";

export const jobsRouter = Router();

function mapJob(row: typeof jobs.$inferSelect) {
  return {
    id: row.id,
    seed_url: row.url,
    job_type: row.type,
    status: row.status,
    created_at: row.createdAt?.toISOString() ?? "",
    started_at: undefined as string | undefined,
    completed_at: undefined as string | undefined,
    engine: undefined as string | undefined,
    pages_scraped: 0,
    error_message: row.error ?? undefined,
    cost_cents: undefined as number | undefined,
  };
}

jobsRouter.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const offset = (page - 1) * per_page;

    const allJobs = await db
      .select()
      .from(jobs)
      .orderBy(desc(jobs.createdAt))
      .limit(per_page)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobs);
    const total = Number(count);
    const total_pages = Math.ceil(total / per_page);

    res.json({
      data: allJobs.map(mapJob),
      total,
      page,
      per_page,
      total_pages,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

jobsRouter.get("/:id", async (req, res) => {
  try {
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, req.params.id as any));

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    const attempts = await db
      .select()
      .from(engineAttempts)
      .where(eq(engineAttempts.jobId, job.id))
      .orderBy(engineAttempts.createdAt);

    const llmCallRows = await db
      .select()
      .from(llmCalls)
      .where(eq(llmCalls.jobId, job.id as any))
      .orderBy(llmCalls.createdAt);

    const [pageCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pages)
      .where(eq(pages.jobId, job.id as any));

    const waterfall = attempts.map((a, i) => ({
      engine: a.engineName,
      started_at: a.createdAt?.toISOString() ?? "",
      completed_at: undefined as string | undefined,
      status: a.status as "success" | "failed" | "timeout",
      error_message: a.error ?? undefined,
      attempt: i + 1,
    }));

    const llm_calls = llmCallRows.map(c => ({
      id: c.id,
      model: c.model,
      prompt_tokens: c.tokensIn ?? 0,
      completion_tokens: c.tokensOut ?? 0,
      cost_cents: c.costEstimateCents ?? 0,
      created_at: c.createdAt?.toISOString() ?? "",
    }));

    res.json({
      id: job.id,
      seed_url: job.url,
      job_type: job.type,
      status: job.status,
      created_at: job.createdAt?.toISOString() ?? "",
      error_message: job.error ?? undefined,
      pages_scraped: Number(pageCount?.count ?? 0),
      waterfall,
      artifacts: [],
      extraction: undefined,
      llm_calls,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

jobsRouter.post("/:id/replay", async (req, res) => {
  try {
    const [originalJob] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, req.params.id as any));

    if (!originalJob) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    const [newJob] = await db
      .insert(jobs)
      .values({
        type: originalJob.type,
        url: originalJob.url,
        payload: originalJob.payload,
        mode: originalJob.mode,
        config: originalJob.config,
        status: "pending",
        priority: originalJob.priority,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.json({ success: true, data: mapJob(newJob) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
