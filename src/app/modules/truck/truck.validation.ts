import { z } from 'zod';

export const TruckValidations = {
  create: z.object({
    body: z.object({
      identifier: z.string({ required_error: 'Identifier is required' }),
      status: z.enum(['active', 'maintenance', 'inactive']).optional(),
      assignedDriver: z.string().optional(),
    }),
  }),

  update: z.object({
    body: z.object({
      identifier: z.string().optional(),
      status: z.enum(['active', 'maintenance', 'inactive']).optional(),
      assignedDriver: z.string().optional(),
    }),
  }),
};
