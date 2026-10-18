import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';

export const LEAVE_APPLY_ERROR_CODES = [
  'LEAVE_BALANCE_NOT_CONFIGURED',
  'LEAVE_INSUFFICIENT_BALANCE',
  'LEAVE_INVALID_DATE_RANGE',
  'LEAVE_INVALID_TYPE',
  'LEAVE_CREATE_FAILED',
  'LEAVE_SUBMIT_UNEXPECTED',
  'LEAVE_TYPE_REQUIRED',
  'LEAVE_TYPE_INVALID',
  'LEAVE_FROM_REQUIRED',
  'LEAVE_TO_REQUIRED',
  'LEAVE_VALIDATION_FAILED',
] as const;

export type LeaveApplyErrorCode = (typeof LEAVE_APPLY_ERROR_CODES)[number];

type LeaveApplyErrorDef = {
  statusCode: number;
  message: string;
};

export const LEAVE_APPLY_ERRORS: Record<
  LeaveApplyErrorCode,
  LeaveApplyErrorDef
> = {
  LEAVE_BALANCE_NOT_CONFIGURED: {
    statusCode: StatusCodes.NOT_FOUND,
    message:
      'Your employer has not set up leave allowances yet. Please contact your manager or HR.',
  },
  LEAVE_INSUFFICIENT_BALANCE: {
    statusCode: StatusCodes.BAD_REQUEST,
    message:
      'You do not have enough leave days for this request. Try fewer days or another leave type.',
  },
  LEAVE_INVALID_DATE_RANGE: {
    statusCode: StatusCodes.BAD_REQUEST,
    message:
      'Those dates are not valid. The end date must be on or after the start date.',
  },
  LEAVE_INVALID_TYPE: {
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'That leave type is not available. Please choose another type.',
  },
  LEAVE_CREATE_FAILED: {
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'We could not save your leave request. Please try again.',
  },
  LEAVE_SUBMIT_UNEXPECTED: {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Unable to submit leave request. Please try again later.',
  },
  LEAVE_TYPE_REQUIRED: {
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Please select a leave type.',
  },
  LEAVE_TYPE_INVALID: {
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Please select a valid leave type.',
  },
  LEAVE_FROM_REQUIRED: {
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Please select a start date.',
  },
  LEAVE_TO_REQUIRED: {
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Please select an end date.',
  },
  LEAVE_VALIDATION_FAILED: {
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Please check your leave details and try again.',
  },
};

export function leaveApplyApiError(code: LeaveApplyErrorCode): ApiError {
  const def = LEAVE_APPLY_ERRORS[code];
  return new ApiError(def.statusCode, def.message, code);
}

/** Resolve Zod required_error text (no params) to a stable code. */
export function leaveApplyErrorCodeFromMessage(
  message: string,
): LeaveApplyErrorCode | undefined {
  const trimmed = message.trim();
  for (const code of LEAVE_APPLY_ERROR_CODES) {
    if (LEAVE_APPLY_ERRORS[code].message === trimmed) {
      return code;
    }
  }
  return undefined;
}
