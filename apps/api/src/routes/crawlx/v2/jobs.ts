import { Router } from "express";
import { db } from "../../../lib/db";
import { jobs, engineAttempts, llmCalls, pages } from "@crawlx/db";
import { eq, desc, sql, inArray } from "drizzle-orm";

export const jobsRouter = Router();

type JobListMeta = {
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly engine?: string;
  readonly pages_scraped: number;
  readonly cost_cents?: number;
};

function isTerminalStatus(status: string): boolean {
  return (
    status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
  );
}

function mapJob(row: typeof jobs.$inferSelect, meta?: JobListMeta) {
  return {
    id: row.id,
    seed_url: row.url,
    job_type: row.type,
    status: row.status,
    created_at: row.createdAt?.toISOString() ?? "",
    started_at: meta?.started_at,
    completed_at:
      meta?.completed_at ??
      (isTerminalStatus(row.status)
        ? (row.updatedAt?.toISOString() ?? undefined)
        : undefined),
    engine: meta?.engine,
    pages_scraped: meta?.pages_scraped ?? 0,
    error_message: row.error ?? undefined,
    cost_cents: meta?.cost_cents,
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

    const jobIds = allJobs.map(job => job.id);

    const [attemptRows, llmCostRows, pageCountRows] =
      jobIds.length > 0
        ? await Promise.all([
            db
              .select({
                jobId: engineAttempts.jobId,
                engineName: engineAttempts.engineName,
                status: engineAttempts.status,
                createdAt: engineAttempts.createdAt,
              })
              .from(engineAttempts)
              .where(inArray(engineAttempts.jobId, jobIds))
              .orderBy(engineAttempts.createdAt),
            db
              .select({
                jobId: llmCalls.jobId,
                cost_cents: sql<number>`sum(coalesce(${llmCalls.costEstimateCents}, 0))`,
              })
              .from(llmCalls)
              .where(inArray(llmCalls.jobId, jobIds))
              .groupBy(llmCalls.jobId),
            db
              .select({
                jobId: pages.jobId,
                count: sql<number>`count(*)`,
              })
              .from(pages)
              .where(inArray(pages.jobId, jobIds))
              .groupBy(pages.jobId),
          ])
        : [[], [], []];

    const attemptsByJob = new Map<string, typeof attemptRows>();
    for (const attempt of attemptRows) {
      const attempts = attemptsByJob.get(attempt.jobId) ?? [];
      attempts.push(attempt);
      attemptsByJob.set(attempt.jobId, attempts);
    }

    const llmCostByJob = new Map(
      llmCostRows.map(row => [row.jobId, Number(row.cost_cents)]),
    );
    const pageCountByJob = new Map(
      pageCountRows.map(row => [row.jobId, Number(row.count)]),
    );

    const jobMetaById = new Map<string, JobListMeta>();
    for (const job of allJobs) {
      const attempts = attemptsByJob.get(job.id) ?? [];
      const successAttempt = attempts.find(
        attempt => attempt.status === "success",
      );
      const lastAttempt = attempts[attempts.length - 1];
      const cost_cents = llmCostByJob.get(job.id);

      jobMetaById.set(job.id, {
        started_at: attempts[0]?.createdAt?.toISOString(),
        completed_at: isTerminalStatus(job.status)
          ? (job.updatedAt?.toISOString() ?? undefined)
          : undefined,
        engine: successAttempt?.engineName ?? lastAttempt?.engineName,
        pages_scraped: pageCountByJob.get(job.id) ?? 0,
        cost_cents: cost_cents && cost_cents > 0 ? cost_cents : undefined,
      });
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobs);
    const total = Number(count);
    const total_pages = Math.ceil(total / per_page);

    res.json({
      data: allJobs.map(job => mapJob(job, jobMetaById.get(job.id))),
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

    const pageRows = await db
      .select()
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

    const artifacts: Array<{
      content_hash: string;
      content_type: "html" | "markdown" | "screenshot" | "pdf";
      size_bytes: number;
      created_at: string;
    }> = [];
    for (const p of pageRows) {
      const ts = p.createdAt.toISOString();
      if (p.markdownHash)
        artifacts.push({
          content_hash: p.markdownHash,
          content_type: "markdown",
          size_bytes: 0,
          created_at: ts,
        });
      if (p.renderedHtmlHash)
        artifacts.push({
          content_hash: p.renderedHtmlHash,
          content_type: "html",
          size_bytes: 0,
          created_at: ts,
        });
      if (p.screenshotHash)
        artifacts.push({
          content_hash: p.screenshotHash,
          content_type: "screenshot",
          size_bytes: 0,
          created_at: ts,
        });
    }

    const started_at = attempts[0]?.createdAt?.toISOString();
    const completed_at = isTerminalStatus(job.status)
      ? (job.updatedAt?.toISOString() ?? undefined)
      : undefined;
    const successAttempt = attempts.find(a => a.status === "success");
    const engine =
      successAttempt?.engineName ?? attempts[attempts.length - 1]?.engineName;
    const cost_cents = llmCallRows.reduce(
      (acc, c) => acc + (c.costEstimateCents ?? 0),
      0,
    );

    res.json({
      id: job.id,
      seed_url: job.url,
      job_type: job.type,
      status: job.status,
      created_at: job.createdAt?.toISOString() ?? "",
      started_at,
      completed_at,
      engine,
      error_message: job.error ?? undefined,
      pages_scraped: pageRows.length,
      cost_cents: cost_cents > 0 ? cost_cents : undefined,
      waterfall,
      artifacts,
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
