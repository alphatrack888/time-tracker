import { z } from 'zod';
import { LEAVE_TYPES, isLeaveType } from './leaveTypes';
import { LEAVE_APPLY_ERRORS } from './leaveApplyErrors';

export const LeavemanagementValidations = {
  create: z.object({
    body: z.object({
      type: z.string({
        required_error: LEAVE_APPLY_ERRORS.LEAVE_TYPE_REQUIRED.message,
        invalid_type_error: LEAVE_APPLY_ERRORS.LEAVE_TYPE_INVALID.message,
      }).refine((val) => isLeaveType(val), {
        message: LEAVE_APPLY_ERRORS.LEAVE_TYPE_INVALID.message,
        params: { errorCode: 'LEAVE_TYPE_INVALID' },
      }),
      from: z.string({
        required_error: LEAVE_APPLY_ERRORS.LEAVE_FROM_REQUIRED.message,
        invalid_type_error: LEAVE_APPLY_ERRORS.LEAVE_FROM_REQUIRED.message,
      }),
      to: z.string({
        required_error: LEAVE_APPLY_ERRORS.LEAVE_TO_REQUIRED.message,
        invalid_type_error: LEAVE_APPLY_ERRORS.LEAVE_TO_REQUIRED.message,
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
