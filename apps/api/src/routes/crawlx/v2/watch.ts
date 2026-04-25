import { Router } from "express";
import { v7 as uuidv7 } from "uuid";
import { db } from "../../../lib/db";
import { watchJobs } from "@crawlx/db";

export const watchRouter = Router();

watchRouter.post("/", async (req, res) => {
  try {
    const { url, interval, schema, webhook } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "URL is required" });
    }

    const watchId = uuidv7();

    await db.insert(watchJobs).values({
      id: watchId as any,
      url,
      interval: interval || "24h",
      active: true,
      lastCheckAt: null,
      nextCheckAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24h
      schema: schema || null,
      webhook: webhook || null,
    });

    res.json({ success: true, watchId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

watchRouter.get("/", async (req, res) => {
  try {
    const allWatches = await db.select().from(watchJobs);
    res.json({ watches: allWatches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
