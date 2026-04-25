import { Router } from "express";
import { db } from "../../../lib/db";
import { domainPolicies } from "@crawlx/db";
import { eq } from "drizzle-orm";

export const domainsRouter = Router();

function mapPolicy(row: typeof domainPolicies.$inferSelect) {
  const rl = row.rateLimit as Record<string, number> | null;
  return {
    domain: row.domain,
    action: "allow" as "allow" | "block" | "rate_limit",
    rate_limit_rpm:
      (rl?.requestsPerMinute ?? rl?.requestsPerSecond != null)
        ? Math.round((rl!.requestsPerSecond ?? 0) * 60)
        : undefined,
    max_depth: undefined as number | undefined,
    created_at: row.updatedAt?.toISOString() ?? "",
    updated_at: row.updatedAt?.toISOString() ?? "",
  };
}

domainsRouter.get("/", async (req, res) => {
  try {
    const policies = await db.select().from(domainPolicies);
    res.json(policies.map(mapPolicy));
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

domainsRouter.get("/:domain", async (req, res) => {
  try {
    const [policy] = await db
      .select()
      .from(domainPolicies)
      .where(eq(domainPolicies.domain, req.params.domain));

    if (!policy) {
      return res
        .status(404)
        .json({ success: false, error: "Policy not found" });
    }

    res.json(mapPolicy(policy));
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

domainsRouter.post("/", async (req, res) => {
  try {
    const { domain, action, rate_limit_rpm, max_depth } = req.body;

    if (!domain) {
      return res
        .status(400)
        .json({ success: false, error: "Domain is required" });
    }

    const rateLimit =
      rate_limit_rpm != null ? { requestsPerMinute: rate_limit_rpm } : null;

    const [newPolicy] = await db
      .insert(domainPolicies)
      .values({
        domain,
        rateLimit,
        pathPatterns: [],
      })
      .returning();

    res.json(mapPolicy(newPolicy));
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

domainsRouter.patch("/:domain", async (req, res) => {
  try {
    const { action, rate_limit_rpm, max_depth } = req.body;
    const domain = req.params.domain;

    const rateLimit =
      rate_limit_rpm != null
        ? { requestsPerMinute: rate_limit_rpm }
        : undefined;

    const [updatedPolicy] = await db
      .update(domainPolicies)
      .set({
        ...(rateLimit !== undefined && { rateLimit }),
        updatedAt: new Date(),
      })
      .where(eq(domainPolicies.domain, domain))
      .returning();

    if (!updatedPolicy) {
      return res
        .status(404)
        .json({ success: false, error: "Policy not found" });
    }

    res.json(mapPolicy(updatedPolicy));
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// PUT upsert — kept for compatibility
domainsRouter.put("/:domain", async (req, res) => {
  try {
    const { robotsTxt, rateLimit, pathPatterns } = req.body;
    const domain = req.params.domain;

    await db
      .insert(domainPolicies)
      .values({
        domain,
        robotsTxt,
        rateLimit,
        pathPatterns: pathPatterns || [],
      })
      .onConflictDoUpdate({
        target: domainPolicies.domain,
        set: {
          robotsTxt,
          rateLimit,
          pathPatterns: pathPatterns || [],
          updatedAt: new Date(),
        },
      });

    res.json({ success: true, message: `Policy for ${domain} updated` });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
