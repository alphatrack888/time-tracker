import { z } from 'zod';

export const PackageValidations = {
  create: z.object({
     body: z.object({
      title: z.string(),
      price: z.number(),
      features: z.array(z.string()),
      isActive: z.boolean(),
     })
  }),

  update: z.object({
    body: z.object({
      title: z.string().optional(),
      price: z.number().optional(),
      features: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    })
  }),
};
