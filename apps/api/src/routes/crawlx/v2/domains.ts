import { Router } from "express";
import { db } from "../../../lib/db";
import { domainPolicies } from "@crawlx/db";
import { eq } from "drizzle-orm";

export const domainsRouter = Router();

function mapPolicy(row: typeof domainPolicies.$inferSelect) {
  const rl = row.rateLimit as Record<string, number> | null;
  return {
    domain: row.domain,
    action: (row.action ?? "allow") as "allow" | "block" | "rate_limit",
    rate_limit_rpm:
      rl?.requestsPerMinute ??
      (rl?.requestsPerSecond != null
        ? Math.round(rl.requestsPerSecond * 60)
        : undefined),
    max_depth: row.maxDepth ?? undefined,
    browser_mode: row.browserMode ?? "static",
    session_backend: row.sessionBackend ?? "crawlx_local",
    requires_named_profile: row.requiresNamedProfile ?? false,
    requires_manual_approval: row.requiresManualApproval ?? false,
    allow_cloud_escalation: row.allowCloudEscalation ?? false,
    allows_external_browser_backend: row.allowsExternalBrowserBackend ?? false,
    requires_human_session: row.requiresHumanSession ?? false,
    requires_operator_handoff: row.requiresOperatorHandoff ?? false,
    created_at: row.createdAt?.toISOString() ?? "",
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
    const {
      domain,
      action,
      rate_limit_rpm,
      max_depth,
      browser_mode,
      session_backend,
      requires_named_profile,
      requires_manual_approval,
      allow_cloud_escalation,
      allows_external_browser_backend,
      requires_human_session,
      requires_operator_handoff,
    } = req.body;

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
        action: action ?? "allow",
        rateLimit,
        pathPatterns: [],
        maxDepth: max_depth ?? null,
        browserMode: browser_mode ?? "static",
        sessionBackend: session_backend ?? "crawlx_local",
        requiresNamedProfile: requires_named_profile ?? false,
        requiresManualApproval: requires_manual_approval ?? false,
        allowCloudEscalation: allow_cloud_escalation ?? false,
        allowsExternalBrowserBackend: allows_external_browser_backend ?? false,
        requiresHumanSession: requires_human_session ?? false,
        requiresOperatorHandoff: requires_operator_handoff ?? false,
      })
      .returning();

    res.json(mapPolicy(newPolicy));
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

domainsRouter.patch("/:domain", async (req, res) => {
  try {
    const {
      action,
      rate_limit_rpm,
      max_depth,
      browser_mode,
      session_backend,
      requires_named_profile,
      requires_manual_approval,
      allow_cloud_escalation,
      allows_external_browser_backend,
      requires_human_session,
      requires_operator_handoff,
    } = req.body;
    const domain = req.params.domain;

    const rateLimit =
      rate_limit_rpm != null
        ? { requestsPerMinute: rate_limit_rpm }
        : undefined;

    const [updatedPolicy] = await db
      .update(domainPolicies)
      .set({
        ...(action !== undefined && { action }),
        ...(rateLimit !== undefined && { rateLimit }),
        ...(max_depth !== undefined && { maxDepth: max_depth ?? null }),
        ...(browser_mode !== undefined && { browserMode: browser_mode }),
        ...(session_backend !== undefined && {
          sessionBackend: session_backend,
        }),
        ...(requires_named_profile !== undefined && {
          requiresNamedProfile: requires_named_profile,
        }),
        ...(requires_manual_approval !== undefined && {
          requiresManualApproval: requires_manual_approval,
        }),
        ...(allow_cloud_escalation !== undefined && {
          allowCloudEscalation: allow_cloud_escalation,
        }),
        ...(allows_external_browser_backend !== undefined && {
          allowsExternalBrowserBackend: allows_external_browser_backend,
        }),
        ...(requires_human_session !== undefined && {
          requiresHumanSession: requires_human_session,
        }),
        ...(requires_operator_handoff !== undefined && {
          requiresOperatorHandoff: requires_operator_handoff,
        }),
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
    const {
      robotsTxt,
      rateLimit,
      pathPatterns,
      browserMode,
      sessionBackend,
      requiresNamedProfile,
      requiresManualApproval,
      allowCloudEscalation,
      allowsExternalBrowserBackend,
      requiresHumanSession,
      requiresOperatorHandoff,
    } = req.body;
    const domain = req.params.domain;

    await db
      .insert(domainPolicies)
      .values({
        domain,
        action: req.body.action ?? "allow",
        robotsTxt,
        rateLimit,
        pathPatterns: pathPatterns || [],
        maxDepth: req.body.max_depth ?? null,
        browserMode: browserMode ?? "static",
        sessionBackend: sessionBackend ?? "crawlx_local",
        requiresNamedProfile: requiresNamedProfile ?? false,
        requiresManualApproval: requiresManualApproval ?? false,
        allowCloudEscalation: allowCloudEscalation ?? false,
        allowsExternalBrowserBackend: allowsExternalBrowserBackend ?? false,
        requiresHumanSession: requiresHumanSession ?? false,
        requiresOperatorHandoff: requiresOperatorHandoff ?? false,
      })
      .onConflictDoUpdate({
        target: domainPolicies.domain,
        set: {
          action: req.body.action ?? "allow",
          robotsTxt,
          rateLimit,
          pathPatterns: pathPatterns || [],
          maxDepth: req.body.max_depth ?? null,
          browserMode: browserMode ?? "static",
          sessionBackend: sessionBackend ?? "crawlx_local",
          requiresNamedProfile: requiresNamedProfile ?? false,
          requiresManualApproval: requiresManualApproval ?? false,
          allowCloudEscalation: allowCloudEscalation ?? false,
          allowsExternalBrowserBackend: allowsExternalBrowserBackend ?? false,
          requiresHumanSession: requiresHumanSession ?? false,
          requiresOperatorHandoff: requiresOperatorHandoff ?? false,
          updatedAt: new Date(),
        },
      });

    res.json({ success: true, message: `Policy for ${domain} updated` });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
