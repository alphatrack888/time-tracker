import { z } from 'zod';

export const PayroleValidations = {
  create: z.object({
  
    body: z.object({
      payroleDate: z.string().datetime().optional(),
      project: z.string().optional(),
      documents: z.array(z.string()),
    }),
  }),

  update: z.object({
    body: z.object({
      payroleDate: z.string().datetime().optional(),
      project: z.string().optional(),
      documents: z.array(z.string()).optional(),
    }),
  }),
};
