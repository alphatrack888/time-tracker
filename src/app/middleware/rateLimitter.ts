import { NextFunction, Request, Response } from "express";
import CacheService from "../../helpers/cacheServices";

// Create a singleton instance of CacheService
const cacheService = new CacheService();

const rateLimitMiddleware = (maxRequests: number, windowMs: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `ratelimit:${req.ip}`;
      const current = await cacheService.increment(key, 1, {
        ttl: Math.floor(windowMs / 1000) 
      });
      
      if (current > maxRequests) {
        return res.status(429).json({ 
          error: 'Too many requests',
          retryAfter: windowMs / 1000
        });
      }
      
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
      
      next();
    } catch (error) {
      next();
    }
  };
};

export default rateLimitMiddleware;