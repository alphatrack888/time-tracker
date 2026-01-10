import mongoose from 'mongoose';
import { z } from 'zod';

export const LeavebalanceValidations = {
  create: z.object({
    body: z.object({
      casualLeave: z.number(),
      sickLeave: z.number(),
      earnLeave: z.number(),
      wpLeave: z.number(),
    }),
  }),

  update: z.object({
    body: z.object({
      casualLeave: z.number().optional(),
      sickLeave: z.number().optional(),
      earnLeave: z.number().optional(),
      wpLeave: z.number().optional(),
    }),
  }),
  delete: z.object({
    params: z.object({
      id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: 'Invalid ObjectId, please try again with a valid ObjectId',
      }),
    }),
  }),
  getSingle: z.object({
    params: z.object({
      id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: 'Invalid ObjectId, please try again with a valid ObjectId',
      }),
    }),
  }),
  getByCompany: z.object({
    params: z.object({
      companyId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: 'Invalid ObjectId, please try again with a valid ObjectId',
      }),
    }),
  }),
};
