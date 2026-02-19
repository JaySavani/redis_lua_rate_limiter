import redis from "../config/redis";
import { SLIDING_WINDOW_LUA, TOKEN_BUCKET_LUA } from "../utils/lua-scripts";

export interface RateLimitResultSlidingWindow {
  allowed: boolean;
  currentCount: number;
  retryAfter: number;
}

export interface RateLimitResultTokenBucket {
  allowed: boolean;
  remaining: number;
}

export class RateLimitService {
  /**
   * Sliding Window Algorithm
   */
  async slidingWindow(
    key: string,
    windowMs: number,
    maxRequests: number,
  ): Promise<RateLimitResultSlidingWindow> {
    try {
      const now = Date.now();
      const requestId = `${now}:${Math.random().toString(36).substring(2, 8)}`;

      // Execute Lua script: {allowed, currentCount, retryAfter}
      const result = (await redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        `ratelimit:sw:${key}`,
        now.toString(),
        windowMs.toString(),
        maxRequests.toString(),
        requestId,
      )) as [number, number, number];

      const allowed = result[0] === 1;
      const currentCount = result[1];
      const retryAfter = result[2];

      return {
        allowed,
        currentCount,
        retryAfter,
      };
    } catch (error) {
      console.error("Sliding window error:", error);
      // Fallback: allow request on Redis failure (fail-open)
      return { allowed: true, currentCount: -1, retryAfter: -1 };
    }
  }

  /**
   * Token Bucket Algorithm
   */
  async tokenBucket(
    key: string,
    capacity: number,
    refillRate: number,
  ): Promise<RateLimitResultTokenBucket> {
    try {
      const now = Date.now() / 1000; 
      const result = (await redis.eval(
        TOKEN_BUCKET_LUA,
        1,
        `ratelimit:tb:${key}`,
        now.toString(),
        capacity.toString(),
        refillRate.toString(),
      )) as [number, number];

      return {  
        allowed: result[0] === 1,
        remaining: result[1],
      };
    } catch (error) {
      console.error("Token bucket error:", error);
      return { allowed: true, remaining: -1 };
    }
  }
}

export const rateLimitService = new RateLimitService();
