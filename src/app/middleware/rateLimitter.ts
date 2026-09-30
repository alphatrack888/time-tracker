import { NextFunction, Request, Response } from "express";
import CacheService from "../../helpers/cacheServices";

// Create a singleton instance of CacheService
const cacheService = new CacheService();

const rateLimitMiddleware = (maxRequests: number, windowMs: number) => {
  // Return type pinned to `Promise<void>` — matches Express's RequestHandler
  // signature. Before Phase 14 this middleware wasn't wired into any route,
  // so `return res.status(429).json(...)` (which resolves to `Response`,
  // not `void`) never actually got type-checked against that signature;
  // wiring it up here surfaced the mismatch, fixed by not returning the
  // Response value itself.
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `ratelimit:${req.ip}`;
      const current = await cacheService.increment(key, 1, {
        ttl: Math.floor(windowMs / 1000)
      });

      if (current > maxRequests) {
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: windowMs / 1000
        });
        return;
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      next();
    } catch {
      next();
    }
  };
};

export default rateLimitMiddleware;