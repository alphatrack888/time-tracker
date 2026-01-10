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
};
