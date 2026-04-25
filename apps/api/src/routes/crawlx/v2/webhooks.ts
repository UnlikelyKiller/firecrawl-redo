import { Router } from "express";
import { db } from "../../../lib/db";
import { webhookSubscriptions } from "@crawlx/db";
import { eq, desc } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

export const webhooksRouter = Router();

webhooksRouter.get("/", async (req, res) => {
  try {
    const allWebhooks = await db
      .select()
      .from(webhookSubscriptions)
      .orderBy(desc(webhookSubscriptions.createdAt));
    res.json({ webhooks: allWebhooks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

webhooksRouter.post("/", async (req, res) => {
  try {
    const { url, eventTypes } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    const [newWebhook] = await db
      .insert(webhookSubscriptions)
      .values({
        id: uuidv7() as any,
        url,
        events: eventTypes || ["job.completed", "job.failed"],
        active: true,
        secret: uuidv7(),
      })
      .returning();

    res.json({ success: true, webhook: newWebhook });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

webhooksRouter.delete("/:id", async (req, res) => {
  try {
    await db
      .delete(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, req.params.id as any));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
