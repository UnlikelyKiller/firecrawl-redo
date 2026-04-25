import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", async (req, res) => {
  res.json({ status: "ok" });
});
