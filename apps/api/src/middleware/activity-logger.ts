import { Request, Response, NextFunction } from "express";
import { db } from "../lib/db";
import { activityLog } from "@crawlx/db";

export const activityLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { method, path, ip } = req;
    const { statusCode } = res;

    db.insert(activityLog)
      .values({
        entityType: "SYSTEM",
        event: "API_REQUEST",
        level: statusCode >= 400 ? "WARN" : "INFO",
        message: `${method} ${path} - ${statusCode} (${duration}ms)`,
        metadata: {
          method,
          path,
          statusCode,
          duration,
          ip,
          userAgent: req.get("user-agent"),
        },
      })
      .catch(err => {
        console.error("Failed to log activity:", err);
      });
  });

  next();
};
