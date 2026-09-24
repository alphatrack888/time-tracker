import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { NotificationPreferenceServices } from './notificationpreferences.service';

const getMyPreferences = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationPreferenceServices.getPreferences(req.user!);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification preferences retrieved successfully',
    data: result,
  });
});

const updateMyPreferences = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationPreferenceServices.updatePreferences(req.user!, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification preferences updated successfully',
    data: result,
  });
});

export const NotificationPreferenceController = {
  getMyPreferences,
  updateMyPreferences,
};
