import { z } from 'zod';

const hoursAtMostTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6

export const ProjectValidations = {
  create: z.object({
    body: z.object({
      title: z.string({
        required_error: 'Title is required',
      }).trim().min(1, 'Title is required').max(120, 'Title cannot exceed 120 characters'),
      startDate: z.string({
        required_error: 'Start date is required',
      }).datetime(),
      endDate: z.string({
        required_error: 'End date is required',
      }).datetime(),
      projectTime: z.number({
        required_error: 'Project time is required',
        invalid_type_error: 'Project time must be a number of hours',
      }).gt(0, 'Project time must be greater than 0').max(100000, 'Project time cannot exceed 100000 hours').refine(hoursAtMostTwoDecimals, 'Project time can have at most two decimal places'),
      images: z.array(z.string({
        required_error: 'A photo is required',
      }), { required_error: 'A photo is required' }).min(1, 'A photo is required'),
      audio: z.array(z.string()).optional(),
      description: z.string({
        required_error: 'Description is required',
      }).trim().min(1, 'Description is required').max(2000, 'Description cannot exceed 2000 characters'),
      employees: z.array(z.string()).optional(),
    }).refine(
      (body) => new Date(body.endDate) >= new Date(body.startDate),
      { message: 'End date must not be before the start date', path: ['endDate'] },
    ),
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
