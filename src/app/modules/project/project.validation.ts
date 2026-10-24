import { z } from 'zod';

export const ProjectValidations = {
  create: z.object({
    body: z.object({
      title: z.string({
        required_error: 'Title is required',
      }),
      startDate: z.string({
        required_error: 'Start date is required',
      }).datetime(),
      endDate: z.string({
        required_error: 'End date is required',
      }).datetime(),
      projectTime: z.number({
        required_error: 'Project time is required',
      }),
      images: z.array(z.string({
        required_error: 'Image is required',
      })),
      audio: z.array(z.string()).optional(),
      description: z.string({
        required_error: 'Description is required',
      }),
    }),
  }),

  update: z.object({
    body: z.object({
      title: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      projectTime: z.number().optional(),
      images: z.array(z.string()).optional(),
      audio: z.string().optional(),
      description: z.string().optional(),
      employees: z.array(z.string()).optional(),
    }),
  }),

  setDailyAllocation: z.object({
    params: z.object({
      id: z.string(),
    }),
    body: z.object({
      employee: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
      hours: z.number().min(0),
    }),
  }),
};
