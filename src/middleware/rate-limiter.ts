import { Request, Response, NextFunction } from "express";
import { rateLimitService } from "../services/rate-limit-algorithms";

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  algorithm: "sliding-window" | "token-bucket";
  refillRate?: number; // tokens per second
  capacity?: number;
}

export const rateLimiter = ({
  windowMs = 1000,
  max = 1000,
  algorithm = "sliding-window",
  refillRate = 1,
  capacity = 10,
}: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Identify User (Token-based)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Auth token required" });
      }

      const token = authHeader.split(" ")[1];
      const key = token; // Use token as unique identifier

      // Execute Algorithm

      if (algorithm === "token-bucket") {
        const result = await rateLimitService.tokenBucket(
          key,
          capacity,
          refillRate,
        );
        console.log(result);

        if (!result.allowed) {
          res.setHeader("Retry-After", Math.ceil(1 / refillRate));
          return res.status(429).json({
            error: "Too many requests",
          });
        }
      } else {
        const result = await rateLimitService.slidingWindow(key, windowMs, max);

        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader(
          "X-RateLimit-Remaining",
          Math.max(0, max - result.currentCount),
        );

        if (!result.allowed) {
          res.setHeader("Retry-After", result.retryAfter.toString());
          return res.status(429).json({
            error: "Too many requests",
          });
        }
      }

      next();
    } catch (error) {
      console.error("Rate limiting middleware error:", error);
      // "Redis failure fallback" / Graceful degradation
      next();
    }
  };
};
