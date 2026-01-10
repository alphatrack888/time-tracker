import { NextFunction, Request, Response } from "express";
import CacheService from "../../helpers/cacheServices";

// Create a singleton instance of CacheService to avoid creating multiple instances
const cacheService = new CacheService();

// Cache middleware factory
const cacheMiddleware = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cacheKey = `route:${req.method}:${req.originalUrl}`;

      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        console.log('Cache hit:', cacheKey);
        return res.json(cachedData);
      }

      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the response
        cacheService.set(cacheKey, data, { ttl });
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

export default cacheMiddleware;
