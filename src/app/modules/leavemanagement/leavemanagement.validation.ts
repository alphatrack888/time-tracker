import { z } from 'zod';

export const LeavemanagementValidations = {
  create: z.object({
    body: z.object({
      company: z.string(),
      type: z.string({
        required_error: 'Type is required',
        invalid_type_error: 'Type must be a string',
      }).refine((val) => ['earn', 'sick', 'casual', 'wp'].includes(val), {
        message: 'Type must be either earn, sick, casual, or wp',
      }),
      from: z.string({
        required_error: 'From is required',
        invalid_type_error: 'From must be a string',
      }),
      to: z.string({
        required_error: 'To is required',
        invalid_type_error: 'To must be a string',
      }),
      reason: z.string(),
    }),
  }),

  update: z.object({
    body: z.object({
      status: z.string({
        required_error: 'Status is required',
        invalid_type_error: 'Status must be a string',
      }).refine((val) => ['approved', 'rejected'].includes(val), {
        message: 'Status must be either approved or rejected',
      }),
    }),
  }),


};
